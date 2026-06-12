import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import { fetchOAuthClients } from "../../lib/oauthClients";
import { OAUTH_SCOPE_CATALOG } from "../../lib/oauthConsentModels";
import {
  buildAuthorizationUrl,
  buildOAuthWalletTestPlan,
  DEFAULT_WALLET_TEST_SCOPES,
  getExpectedOAuthWalletResponses,
  getOAuthWalletTestSteps,
  evaluateStepResult,
  sanitizeTestOutput,
  SANDBOX_WARNING,
  SECRETS_WARNING,
} from "../../lib/oauthWalletTestHarness";
import {
  buildEvidencePayload,
  generateEvidenceRunId,
  submitOAuthWalletEvidence,
} from "../../lib/oauthWalletTestEvidence";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

function randomState() {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (!value) return;
        try {
          await navigator.clipboard.writeText(String(value));
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function ResultBlock({ expected, actual, evalResult }) {
  if (!actual) return null;
  const safe = sanitizeTestOutput(actual.body);
  return (
    <div className="mt-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected</p>
        <p className="mt-1 text-sm text-slate-700">{expected}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actual</p>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify({ status: actual.status, body: safe }, null, 2)}
        </pre>
      </div>
      {evalResult ? (
        <p
          className={`text-sm font-semibold ${evalResult.pass ? "text-emerald-700" : "text-amber-800"}`}
        >
          {evalResult.pass ? "✓ " : "○ "}
          {evalResult.message}
        </p>
      ) : null}
    </div>
  );
}

function EvidenceStatusPill({ status }) {
  if (!status || status === "disabled") {
    return (
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500">
        Evidence disabled
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Evidence saved
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
        Evidence failed
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
        Saving…
      </span>
    );
  }
  return null;
}

function StepCard({ step, expected, children, result, evalResult, evidence }) {
  return (
    <section
      className="tropicash-surface rounded-2xl p-5 sm:p-6"
      aria-labelledby={`step-${step.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Step {step.order}
          </p>
          <h2 id={`step-${step.id}`} className="text-lg font-bold text-slate-900">
            {step.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {evidence ? <EvidenceStatusPill status={evidence.status} /> : null}
          {step.method && step.path ? (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-700">
              {step.method} {step.path}
            </span>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{step.purpose}</p>
      {children}
      <ResultBlock expected={expected?.summary} actual={result} evalResult={evalResult} />
      {evidence?.onSave ? (
        <div className="mt-4">
          <button
            type="button"
            disabled={evidence.disabled || evidence.status === "saving"}
            onClick={() => void evidence.onSave()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Save evidence
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default function DevConsoleOAuthWalletTestPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;
  const plan = useMemo(() => buildOAuthWalletTestPlan(), []);
  const steps = useMemo(() => getOAuthWalletTestSteps(), []);
  const expectedMap = useMemo(() => getExpectedOAuthWalletResponses(), []);

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedClientId, setSelectedClientId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [state, setState] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const [busy, setBusy] = useState("");
  const [stepResults, setStepResults] = useState({});

  const [runId, setRunId] = useState("");
  const [evidenceRecording, setEvidenceRecording] = useState(false);
  const [evidenceStates, setEvidenceStates] = useState({});
  const [evidenceMessage, setEvidenceMessage] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const { data, error } = await fetchOAuthClients(userId);
    if (error) {
      setLoadError(error.message || "Could not load OAuth clients.");
      setClients([]);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state) setState(randomState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    if (!clients.length) {
      setSelectedClientId("");
      return;
    }
    setSelectedClientId((prev) =>
      prev && clients.some((c) => c.id === prev) ? prev : clients[0].id,
    );
  }, [clients]);

  useEffect(() => {
    const uris = Array.isArray(selectedClient?.redirect_uris)
      ? selectedClient.redirect_uris
      : [];
    setRedirectUri((prev) => (uris.includes(prev) ? prev : uris[0] || ""));
  }, [selectedClient]);

  const clientPublicId = selectedClient?.client_id || "";
  const clientUris = Array.isArray(selectedClient?.redirect_uris)
    ? selectedClient.redirect_uris
    : [];

  const authorizationUrl = useMemo(
    () =>
      buildAuthorizationUrl({
        clientId: clientPublicId,
        redirectUri,
        scopes: DEFAULT_WALLET_TEST_SCOPES,
        state,
      }),
    [clientPublicId, redirectUri, state],
  );

  const canOpenConsent = Boolean(clientPublicId && redirectUri);

  function recordResult(stepId, status, body) {
    const actual = { status, body };
    setStepResults((prev) => ({
      ...prev,
      [stepId]: {
        actual,
        eval: evaluateStepResult(stepId, actual),
      },
    }));
    setEvidenceStates((prev) => {
      if (!prev[stepId]) return prev;
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
  }

  function evidenceStatusFor(stepId) {
    if (!evidenceRecording) return "disabled";
    return evidenceStates[stepId] || null;
  }

  function evidenceProps(stepId, stepLabel) {
    const status = evidenceStatusFor(stepId);
    return {
      status,
      disabled: !evidenceRecording || !runId,
      onSave: () => saveStepEvidence(stepId, stepLabel),
    };
  }

  async function saveStepEvidence(stepId, stepLabel) {
    if (!evidenceRecording) {
      setEvidenceMessage("Enable evidence recording first.");
      return;
    }
    if (!runId) {
      setEvidenceMessage("Generate a run ID before saving evidence.");
      return;
    }

    setEvidenceStates((prev) => ({ ...prev, [stepId]: "saving" }));
    setEvidenceMessage("");

    const stepData = stepResults[stepId];
    let status = "skipped";
    let httpStatus = null;
    let result = { note: "Harness step recorded without API response" };

    if (stepData?.actual) {
      httpStatus = stepData.actual.status ?? null;
      result = {
        status: stepData.actual.status,
        body: stepData.actual.body,
        eval: stepData.eval?.message,
      };
      status = stepData.eval?.pass ? "passed" : "failed";
    }

    const payload = buildEvidencePayload({
      run_id: runId,
      developer_app_id: selectedClient?.app_id ?? null,
      oauth_client_id: selectedClient?.id ?? null,
      step_key: stepId,
      step_label: stepLabel,
      status,
      http_status: httpStatus,
      result,
    });

    const res = await submitOAuthWalletEvidence(payload);
    setEvidenceStates((prev) => ({
      ...prev,
      [stepId]: res.ok ? "saved" : "failed",
    }));
    if (!res.ok) {
      setEvidenceMessage(`Evidence save failed (${stepId}): ${res.error || "unknown"}`);
    }
  }

  async function saveAllEvidence() {
    if (!evidenceRecording || !runId) {
      setEvidenceMessage("Enable recording and generate a run ID first.");
      return;
    }
    setEvidenceMessage("Saving all steps…");
    for (const step of steps) {
      await saveStepEvidence(step.id, step.title);
    }
    setEvidenceMessage("Save all complete.");
  }

  async function exchangeTokens() {
    setBusy("token-exchange");
    try {
      const resp = await fetch("/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientPublicId,
          client_secret: clientSecret.trim(),
          code: authCode.trim(),
          redirect_uri: redirectUri,
        }),
      });
      const body = await resp.json().catch(() => ({}));
      recordResult("token-exchange", resp.status, body);
      if (resp.ok && body.access_token) {
        setAccessToken(body.access_token);
        if (body.refresh_token) setRefreshToken(body.refresh_token);
      }
    } catch (err) {
      recordResult("token-exchange", 0, { ok: false, error: err?.message || "network_error" });
    } finally {
      setBusy("");
    }
  }

  async function callProfile(stepId = "profile-api") {
    setBusy(stepId);
    try {
      const resp = await fetch("/api/oauth/profile", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken.trim()}` },
      });
      const body = await resp.json().catch(() => ({}));
      recordResult(stepId, resp.status, body);
    } catch (err) {
      recordResult(stepId, 0, { ok: false, error: err?.message || "network_error" });
    } finally {
      setBusy("");
    }
  }

  async function callWallet() {
    setBusy("wallet-api");
    try {
      const resp = await fetch("/api/oauth/wallet", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken.trim()}` },
      });
      const body = await resp.json().catch(() => ({}));
      recordResult("wallet-api", resp.status, body);
    } catch (err) {
      recordResult("wallet-api", 0, { ok: false, error: err?.message || "network_error" });
    } finally {
      setBusy("");
    }
  }

  async function refreshTokens() {
    setBusy("refresh-token");
    try {
      const resp = await fetch("/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: clientPublicId,
          client_secret: clientSecret.trim(),
          refresh_token: refreshToken.trim(),
        }),
      });
      const body = await resp.json().catch(() => ({}));
      recordResult("refresh-token", resp.status, body);
      if (resp.ok && body.access_token) {
        setAccessToken(body.access_token);
        if (body.refresh_token) setRefreshToken(body.refresh_token);
      }
    } catch (err) {
      recordResult("refresh-token", 0, { ok: false, error: err?.message || "network_error" });
    } finally {
      setBusy("");
    }
  }

  async function revokeAccessToken() {
    setBusy("revoke-token");
    try {
      const resp = await fetch("/api/oauth/revoke-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: accessToken.trim(),
          token_type_hint: "access_token",
          client_id: clientPublicId,
          client_secret: clientSecret.trim(),
        }),
      });
      const body = await resp.json().catch(() => ({}));
      recordResult("revoke-token", resp.status, body);
    } catch (err) {
      recordResult("revoke-token", 0, { ok: false, error: err?.message || "network_error" });
    } finally {
      setBusy("");
    }
  }

  async function introspectToken() {
    setBusy("introspect");
    try {
      const resp = await fetch("/api/oauth/introspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken.trim() }),
      });
      const body = await resp.json().catch(() => ({}));
      recordResult("introspect", resp.status, body);
    } catch (err) {
      recordResult("introspect", 0, { active: false, error: err?.message || "network_error" });
    } finally {
      setBusy("");
    }
  }

  const scopeCatalog = useMemo(() => OAUTH_SCOPE_CATALOG, []);

  if (authLoading) {
    return (
      <DevConsoleLayout title="OAuth Wallet Test" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="OAuth Wallet Test" subtitle="Sign in to run the wallet sandbox harness.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  const step1 = steps.find((s) => s.id === "select-client");
  const step2 = steps.find((s) => s.id === "authorization-url");
  const step3 = steps.find((s) => s.id === "consent");
  const step4 = steps.find((s) => s.id === "capture-code");
  const step5 = steps.find((s) => s.id === "token-exchange");
  const step6 = steps.find((s) => s.id === "profile-api");
  const step7 = steps.find((s) => s.id === "wallet-api");
  const step8 = steps.find((s) => s.id === "refresh-token");
  const step9 = steps.find((s) => s.id === "revoke-token");
  const step10 = steps.find((s) => s.id === "confirm-revoked");

  return (
    <DevConsoleLayout
      title="OAuth Wallet Test"
      subtitle="End-to-end sandbox harness for OAuth wallet read — diagnostics only, no money movement."
    >
      <div
        role="alert"
        className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <p className="font-semibold">{SANDBOX_WARNING}</p>
        <p className="mt-1">{SECRETS_WARNING}</p>
        <p className="mt-1 text-xs text-amber-800">{plan.persistencePolicy}</p>
      </div>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Evidence recording</h2>
        <p className="mt-1 text-sm text-slate-600">
          Off by default. When enabled, save sanitized pass/fail results per step — never secrets,
          tokens, codes, or balances.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="evidence_run_id" className={labelClass}>
              Run ID
            </label>
            <div className="flex gap-2">
              <input
                id="evidence_run_id"
                type="text"
                readOnly
                value={runId}
                className={`${inputClass} font-mono text-xs`}
                placeholder="Generate a run ID"
              />
              <button
                type="button"
                onClick={() => setRunId(generateEvidenceRunId())}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Generate
              </button>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={evidenceRecording}
              onChange={(e) => setEvidenceRecording(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Evidence recording
          </label>
          <button
            type="button"
            disabled={!evidenceRecording || !runId}
            onClick={() => void saveAllEvidence()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Save all evidence
          </button>
        </div>
        {evidenceMessage ? (
          <p className="mt-3 text-sm text-slate-600">{evidenceMessage}</p>
        ) : null}
        {!evidenceRecording ? (
          <p className="mt-2 text-xs text-slate-500">Evidence recording is off.</p>
        ) : null}
      </section>

      {/* Step 1 */}
      <StepCard
        step={step1}
        expected={expectedMap["select-client"]}
        evidence={evidenceProps(step1.id, step1.title)}
      >
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading clients…</p>
        ) : clients.length ? (
          <div className="mt-4 space-y-4">
            <div className="max-w-md">
              <label htmlFor="wallet_test_client" className={labelClass}>
                OAuth Client
              </label>
              <select
                id="wallet_test_client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={inputClass}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name || c.client_id} ({c.client_id})
                  </option>
                ))}
              </select>
            </div>
            {selectedClient ? (
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Client name</dt>
                  <dd className="text-sm">{selectedClient.client_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">client_id</dt>
                  <dd className="flex items-center gap-2">
                    <code className="text-xs">{selectedClient.client_id}</code>
                    <CopyButton value={selectedClient.client_id} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase text-slate-500">redirect_uri</dt>
                  <dd>
                    {clientUris.length ? (
                      <select
                        value={redirectUri}
                        onChange={(e) => setRedirectUri(e.target.value)}
                        className={`${inputClass} mt-1 max-w-xl`}
                      >
                        {clientUris.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">No redirect URIs registered</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No OAuth clients.{" "}
            <Link href="/dev-console/oauth-clients" className="font-semibold text-tropicash-green-hover underline">
              Create one
            </Link>
          </p>
        )}
      </StepCard>

      {/* Step 2 */}
      <StepCard
        step={step2}
        expected={expectedMap["authorization-url"]}
        evidence={evidenceProps(step2.id, step2.title)}
      >
        <div className="mt-4">
          <p className="text-xs text-slate-500">
            Scopes: <code className="rounded bg-slate-100 px-1">{DEFAULT_WALLET_TEST_SCOPES.join(" ")}</code>
            {" · "}
            Critical scopes disabled
          </p>
          <ul className="mt-2 flex flex-wrap gap-1">
            {scopeCatalog.map((s) => (
              <li
                key={s.scope}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  DEFAULT_WALLET_TEST_SCOPES.includes(s.scope)
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : s.riskLevel === "critical"
                      ? "border-red-200 bg-red-50 text-red-400 line-through"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                {s.scope}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={canOpenConsent ? authorizationUrl : ""}
              className={`${inputClass} font-mono text-xs`}
              placeholder="Select client + redirect URI"
            />
            <CopyButton value={authorizationUrl} label="Copy URL" />
          </div>
        </div>
      </StepCard>

      {/* Step 3 */}
      <StepCard
        step={step3}
        expected={expectedMap.consent}
        evidence={evidenceProps(step3.id, step3.title)}
      >
        <div className="mt-4">
          <button
            type="button"
            disabled={!canOpenConsent}
            onClick={() => {
              if (canOpenConsent) window.open(authorizationUrl, "_blank", "noopener,noreferrer");
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Open consent screen
          </button>
        </div>
      </StepCard>

      {/* Step 4 */}
      <StepCard
        step={step4}
        expected={expectedMap["capture-code"]}
        evidence={evidenceProps(step4.id, step4.title)}
      >
        <div className="mt-4 max-w-md">
          <label htmlFor="auth_code" className={labelClass}>
            Authorization code
          </label>
          <input
            id="auth_code"
            type="text"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            className={inputClass}
            placeholder="tc_auth_…"
            autoComplete="off"
          />
        </div>
      </StepCard>

      {/* Step 5 */}
      <StepCard
        step={step5}
        expected={expectedMap["token-exchange"]}
        result={stepResults["token-exchange"]?.actual}
        evalResult={stepResults["token-exchange"]?.eval}
        evidence={evidenceProps(step5.id, step5.title)}
      >
        <div className="mt-4 grid max-w-md grid-cols-1 gap-3">
          <div>
            <label htmlFor="client_secret" className={labelClass}>
              client_secret (session only — never stored)
            </label>
            <input
              id="client_secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className={inputClass}
              placeholder="tc_secret_…"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            disabled={busy === "token-exchange" || !authCode.trim() || !clientSecret.trim()}
            onClick={() => void exchangeTokens()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === "token-exchange" ? "Exchanging…" : "Exchange tokens"}
          </button>
          {accessToken ? (
            <p className="text-xs text-slate-500">
              Access token in session: {sanitizeTestOutput(accessToken)}
            </p>
          ) : null}
        </div>
      </StepCard>

      {/* Step 6 */}
      <StepCard
        step={step6}
        expected={expectedMap["profile-api"]}
        result={stepResults["profile-api"]?.actual}
        evalResult={stepResults["profile-api"]?.eval}
        evidence={evidenceProps(step6.id, step6.title)}
      >
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy === "profile-api" || !accessToken.trim()}
            onClick={() => void callProfile("profile-api")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "profile-api" ? "Calling…" : "Call profile"}
          </button>
          <button
            type="button"
            disabled={busy === "introspect" || !accessToken.trim()}
            onClick={() => void introspectToken()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Introspect token
          </button>
        </div>
        {stepResults.introspect ? (
          <ResultBlock
            expected={expectedMap.introspect?.summary}
            actual={stepResults.introspect.actual}
          />
        ) : null}
      </StepCard>

      {/* Step 7 */}
      <StepCard
        step={step7}
        expected={expectedMap["wallet-api"]}
        result={stepResults["wallet-api"]?.actual}
        evalResult={stepResults["wallet-api"]?.eval}
        evidence={evidenceProps(step7.id, step7.title)}
      >
        <div className="mt-4">
          <button
            type="button"
            disabled={busy === "wallet-api" || !accessToken.trim()}
            onClick={() => void callWallet()}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === "wallet-api" ? "Calling…" : "Call wallet (read-only)"}
          </button>
        </div>
      </StepCard>

      {/* Step 8 */}
      <StepCard
        step={step8}
        expected={expectedMap["refresh-token"]}
        result={stepResults["refresh-token"]?.actual}
        evalResult={stepResults["refresh-token"]?.eval}
        evidence={evidenceProps(step8.id, step8.title)}
      >
        <div className="mt-4">
          <button
            type="button"
            disabled={
              busy === "refresh-token" ||
              !refreshToken.trim() ||
              !clientSecret.trim()
            }
            onClick={() => void refreshTokens()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "refresh-token" ? "Refreshing…" : "Refresh tokens"}
          </button>
        </div>
      </StepCard>

      {/* Step 9 */}
      <StepCard
        step={step9}
        expected={expectedMap["revoke-token"]}
        result={stepResults["revoke-token"]?.actual}
        evalResult={stepResults["revoke-token"]?.eval}
        evidence={evidenceProps(step9.id, step9.title)}
      >
        <div className="mt-4">
          <button
            type="button"
            disabled={
              busy === "revoke-token" || !accessToken.trim() || !clientSecret.trim()
            }
            onClick={() => void revokeAccessToken()}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            {busy === "revoke-token" ? "Revoking…" : "Revoke access token"}
          </button>
        </div>
      </StepCard>

      {/* Step 10 */}
      <StepCard
        step={step10}
        expected={expectedMap["confirm-revoked"]}
        result={stepResults["confirm-revoked"]?.actual}
        evalResult={stepResults["confirm-revoked"]?.eval}
        evidence={evidenceProps(step10.id, step10.title)}
      >
        <div className="mt-4">
          <button
            type="button"
            disabled={busy === "confirm-revoked" || !accessToken.trim()}
            onClick={() => void callProfile("confirm-revoked")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === "confirm-revoked" ? "Calling…" : "Call profile (revoked token)"}
          </button>
        </div>
      </StepCard>

      <p className="text-sm text-slate-600">
        Docs:{" "}
        <code className="rounded bg-slate-100 px-1 text-xs">
          docs/developer/OAUTH_WALLET_SANDBOX_TEST_HARNESS.md
        </code>
        {" · "}
        <Link href="/dev-console/oauth-wallet-readiness" className="font-semibold text-tropicash-green-hover underline">
          Wallet readiness gate
        </Link>
        {" · "}
        <Link href="/dev-console/oauth-testing" className="font-semibold text-tropicash-green-hover underline">
          OAuth Testing (curl examples)
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
