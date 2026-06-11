import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import OAuthConsentCard from "../../components/oauth/OAuthConsentCard";
import { useUser } from "../../lib/userContext";
import { supabase } from "../../lib/supabaseClient";
import { buildConsentView } from "../../lib/oauthConsentUi";
import { isOAuthCodeIssuanceEnabled } from "../../lib/oauthFeatureFlags";

const shellClass = "min-h-screen bg-slate-50 px-4 py-10";
const cardClass = "tropicash-surface mx-auto w-full max-w-xl rounded-2xl p-5 sm:p-7";

function CenteredCard({ children }) {
  return (
    <>
      <Navbar />
      <main className={shellClass}>
        <div className={cardClass}>{children}</div>
      </main>
    </>
  );
}

function deriveAppName(serverClient, clientId) {
  if (serverClient && serverClient.client_name) return serverClient.client_name;
  if (clientId) return `Application ${clientId}`;
  return "An application";
}

export default function OAuthAuthorizePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();

  const [serverResult, setServerResult] = useState(null);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverFailed, setServerFailed] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvedResult, setApprovedResult] = useState(null);
  const [approveError, setApproveError] = useState("");

  const codeIssuanceEnabled = isOAuthCodeIssuanceEnabled();

  // Build the view-model purely from query params (safe, no side effects).
  const view = useMemo(
    () => (router.isReady ? buildConsentView(router.query) : null),
    [router.isReady, router.query],
  );

  const clientId = view?.request?.clientId ?? "";
  // Only structurally-valid requests get server-validated; missing/unsupported
  // params are handled locally as an "incomplete" state below.
  const shouldValidate = Boolean(view && view.status !== "invalid");
  const requestKey = view
    ? JSON.stringify([
        view.request.clientId,
        view.request.redirectUri,
        view.request.responseType,
        view.request.scopeRaw,
        view.request.state,
      ])
    : null;

  // Phase 12N: authoritative server-side validation. No best-effort client-side
  // DB lookup — the endpoint resolves client metadata and validates the request.
  useEffect(() => {
    let cancelled = false;
    if (!router.isReady || !view || !shouldValidate) {
      setServerResult(null);
      setServerFailed(false);
      setServerLoading(false);
      return undefined;
    }
    setServerLoading(true);
    setServerFailed(false);
    setServerResult(null);
    void (async () => {
      try {
        const res = await fetch("/api/oauth/validate-authorization-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: view.request.clientId,
            redirect_uri: view.request.redirectUri,
            response_type: view.request.responseType,
            scope: view.request.scopeRaw,
            state: view.request.state,
          }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!data || typeof data.ok !== "boolean") {
          setServerFailed(true);
        } else {
          setServerResult(data);
        }
      } catch {
        if (!cancelled) setServerFailed(true);
      } finally {
        if (!cancelled) setServerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, shouldValidate, requestKey, view]);

  const handleDecline = useCallback(() => {
    // Safest behavior — show a local declined state only. No external redirect,
    // no codes/tokens, no consent records.
    setDeclined(true);
  }, []);

  const handleApprove = useCallback(async () => {
    // Approval is only reachable when the feature flag is on AND server
    // validation passed. Issues an authorization CODE only — never a token.
    if (!codeIssuanceEnabled || !view || approving) return;
    setApproving(true);
    setApproveError("");
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? null;
      const authHeaders = {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      };
      const requestBody = {
        client_id: view.request.clientId,
        redirect_uri: view.request.redirectUri,
        response_type: view.request.responseType,
        scope: view.request.scopeRaw,
        state: view.request.state,
      };

      // 1. Record the user's consent grant before issuing any code.
      const consentRes = await fetch("/api/oauth/create-consent", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(requestBody),
      });
      const consentData = await consentRes.json().catch(() => null);
      if (!consentRes.ok || !consentData?.ok || !consentData.consent_id) {
        setApproveError("We couldn't record your consent. Please try again.");
        return;
      }

      // 2. Issue the authorization code bound to the consent record.
      const res = await fetch("/api/oauth/create-authorization-code", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          ...requestBody,
          consent_id: consentData.consent_id,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.authorization_code) {
        setApprovedResult({
          authorizationCode: data.authorization_code,
          expiresIn: data.expires_in,
        });
      } else {
        setApproveError("We couldn't complete this approval. Please try again.");
      }
    } catch {
      setApproveError("We couldn't complete this approval. Please try again.");
    } finally {
      setApproving(false);
    }
  }, [codeIssuanceEnabled, view, approving]);

  // 1. Loading state.
  if (!router.isReady || authLoading || !user || !view) {
    return (
      <CenteredCard>
        <p className="text-center text-sm font-semibold text-slate-600">
          Preparing authorization request…
        </p>
      </CenteredCard>
    );
  }

  // Declined state.
  if (declined) {
    return (
      <CenteredCard>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Request declined</h1>
          <p className="mt-2 text-sm text-slate-600">
            You declined this authorization request. No access was granted and nothing was shared
            with the application.
          </p>
          <div className="mt-5">
            <Link
              href="/wallet"
              className="inline-block rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white hover:bg-tropicash-green-hover"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </CenteredCard>
    );
  }

  // 2. Missing / invalid request state (structurally incomplete).
  if (view.status === "invalid") {
    const { missing, unsupportedResponseType } = view.validation;
    return (
      <CenteredCard>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">
            This authorization request is incomplete
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We could not safely display this request because it is missing required information.
          </p>
        </div>
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {missing.length ? (
            <p>
              Missing parameters:{" "}
              <span className="font-semibold">{missing.join(", ")}</span>.
            </p>
          ) : null}
          {unsupportedResponseType ? (
            <p className={missing.length ? "mt-1" : ""}>
              Unsupported <code>response_type</code>. Only <code>code</code> is supported.
            </p>
          ) : null}
        </div>
        <div className="mt-5 text-center">
          <Link href="/wallet" className="text-sm font-semibold text-tropicash-green-hover underline">
            Return to dashboard
          </Link>
        </div>
      </CenteredCard>
    );
  }

  // Server validation in flight.
  if (serverLoading || (!serverResult && !serverFailed)) {
    return (
      <CenteredCard>
        <p className="text-center text-sm font-semibold text-slate-600">
          Validating authorization request…
        </p>
      </CenteredCard>
    );
  }

  // Validation endpoint unreachable / malformed response — fail safe.
  if (serverFailed) {
    return (
      <CenteredCard>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">
            We couldn&apos;t validate this request
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Something went wrong while checking this authorization request. No access was granted.
            Please try again.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={handleDecline}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Decline
            </button>
          </div>
        </div>
      </CenteredCard>
    );
  }

  // Approved — authorization code issued (feature-flagged path). No tokens.
  if (approvedResult) {
    return (
      <CenteredCard>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Authorization approved</h1>
          <p className="mt-2 text-sm text-slate-600">
            A short-lived authorization code has been issued. It expires in{" "}
            {Math.round((approvedResult.expiresIn ?? 600) / 60)} minutes and can be used once. No
            access tokens were issued.
          </p>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Authorization code
          </label>
          <code className="block w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
            {approvedResult.authorizationCode}
          </code>
        </div>
        <div className="mt-5 text-center">
          <Link
            href="/wallet"
            className="inline-block rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white hover:bg-tropicash-green-hover"
          >
            Back to dashboard
          </Link>
        </div>
      </CenteredCard>
    );
  }

  // 3/4. Consent preview using authoritative server validation result.
  const serverClient = serverResult.ok ? serverResult.client : null;
  const appName = deriveAppName(serverClient, clientId);
  const resolved = Boolean(serverClient && serverClient.client_name);
  const server = {
    errors: serverResult.ok ? [] : serverResult.errors ?? [],
    warnings: serverResult.warnings ?? [],
  };
  // Approve is active only when the feature flag is on AND validation passed.
  const approveEnabled = codeIssuanceEnabled && serverResult.ok;

  return (
    <>
      <Head>
        <title>Authorize access · Tropicash</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Navbar />
      <main className={shellClass}>
        <div className={cardClass}>
          {approveError ? (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {approveError}
            </p>
          ) : null}
          <OAuthConsentCard
            view={view}
            appName={appName}
            environment="Sandbox"
            resolved={resolved}
            onDecline={handleDecline}
            server={server}
            approveEnabled={approveEnabled}
            onApprove={handleApprove}
            approving={approving}
          />
        </div>
      </main>
    </>
  );
}
