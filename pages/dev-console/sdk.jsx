import { useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import { TropicashClient } from "../../lib/sdk/TropicashClient";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

const INSTALL_SAMPLE = `npm install tropicash-sdk`;

const QUICK_START_SAMPLE = `import { TropicashClient } from "tropicash-sdk";

const client = new TropicashClient({
  apiKey: "tc_test_xxx",
  environment: "sandbox",
});

// Verify configuration + connectivity
const result = await client.ping();
// => { ok: true, environment: "sandbox" }`;

const API_METHODS_SAMPLE = `const client = new TropicashClient({
  apiKey: "tc_test_xxx",
  environment: "sandbox",
});

// 1. Platform status
const status = await client.platformStatus();
// => {
//      ok: true,
//      environment: "sandbox",
//      status: "operational",
//      version: "v1",
//      timestamp: "2026-06-06T23:00:00.000Z"
//    }

// 2. Supported currencies
const currencies = await client.supportedCurrencies();
// => {
//      ok: true,
//      currencies: [
//        { code: "USD", name: "US Dollar", status: "active" },
//        { code: "HTG", name: "Haitian Gourde", status: "active" }
//      ]
//    }

// 3. Developer profile (metadata for the calling key)
const profile = await client.profile();
// => {
//      ok: true,
//      organization_id: "...",
//      app_id: "...",
//      environment: "sandbox",
//      public_key: "tc_pub_...",
//      status: "active"
//    }`;

const WEBHOOK_SAMPLE = `import { TropicashWebhookVerifier } from "tropicash-sdk";

// Your webhook signing secret (whsec_...), stored securely.
const verifier = new TropicashWebhookVerifier(process.env.TROPICASH_WEBHOOK_SECRET);

export default async function handler(req, res) {
  const signature = req.headers["x-tropicash-signature"];
  const timestamp = req.headers["x-tropicash-timestamp"];

  const { valid, error } = await verifier.verifySignature({
    payload: req.rawBody,   // the exact raw request body string
    signature,
    timestamp,              // enables replay protection (5 min tolerance)
  });

  if (!valid) {
    return res.status(400).json({ ok: false, error });
  }

  // Signature verified — handle the event.
  return res.status(200).json({ ok: true });
}`;

const ENVIRONMENT_SAMPLE = `import { TropicashEnvironment } from "tropicash-sdk";

const env = new TropicashEnvironment("sandbox");

env.isSandbox();       // true
env.isProduction();    // false
env.getBaseUrl();      // "/api/developer"
env.getDashboardUrl(); // "/dev-console"

// Production is reserved — these throw a descriptive error for now:
const prod = new TropicashEnvironment("production");
prod.getBaseUrl();     // throws: "Production environment is not enabled yet..."`;

const FUTURE_SAMPLE = `// Reserved namespaces (clean extension points — not implemented yet):
client.wallets.*
client.payments.*
client.withdrawals.*
client.accounts.*
client.webhooks.*`;

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code }) {
  return (
    <div className="relative mt-3">
      <div className="absolute right-2 top-2">
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-4 pr-16 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function DevConsoleSdkPage() {
  const { user, loading: authLoading } = useUser();

  const [apiKey, setApiKey] = useState("");
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const runPing = async () => {
    setPingResult(null);
    setPinging(true);
    try {
      const client = new TropicashClient({ apiKey, environment: "sandbox" });
      const result = await client.ping();
      setPingResult(result);
    } catch (err) {
      setPingResult({ ok: false, error: err?.message || "Unexpected error." });
    } finally {
      setPinging(false);
    }
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="SDK" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="SDK" subtitle="Sign in to view the Tropicash SDK documentation.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="SDK"
      subtitle="The official Tropicash SDK foundation — authentication, environment management, and webhook verification. Architecture preview; the package is not published yet."
    >
      {/* 1. Overview */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-overview-heading">
        <h2 id="sdk-overview-heading" className="text-lg font-bold text-slate-900">
          SDK overview
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          The Tropicash SDK removes boilerplate so you can integrate without hand-writing
          authentication, request handling, webhook verification, and environment management.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h3 className="font-semibold text-slate-900">🔐 Authentication</h3>
            <p className="mt-1 text-sm text-slate-600">
              Pass your sandbox API key once; the client attaches the bearer token to every request.
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h3 className="font-semibold text-slate-900">🧭 Environment management</h3>
            <p className="mt-1 text-sm text-slate-600">
              Sandbox is enabled today. Production is reserved and returns descriptive errors.
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h3 className="font-semibold text-slate-900">📩 Webhook verification</h3>
            <p className="mt-1 text-sm text-slate-600">
              HMAC-SHA256 signature checks with constant-time comparison and replay protection.
            </p>
          </li>
          <li className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h3 className="font-semibold text-slate-900">🚀 Future API support</h3>
            <p className="mt-1 text-sm text-slate-600">
              Reserved namespaces for wallets, payments, withdrawals, accounts, and webhooks.
            </p>
          </li>
        </ul>
      </section>

      {/* 2. Installation */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-install-heading">
        <h2 id="sdk-install-heading" className="text-lg font-bold text-slate-900">
          Installation
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Documentation only — the package is not published to npm yet.
        </p>
        <CodeBlock code={INSTALL_SAMPLE} />
      </section>

      {/* Package preview */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-package-heading">
        <h2 id="sdk-package-heading" className="text-lg font-bold text-slate-900">
          Package preview
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The SDK is organized as a package under <code className="rounded bg-slate-100 px-1">sdk/</code>.
          It is private/internal for now. Package publishing is planned for a future release.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Package</dt>
            <dd className="mt-1 font-mono text-sm text-slate-900">@tropicash/sdk</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version</dt>
            <dd className="mt-1 font-mono text-sm text-slate-900">0.1.0</dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private</dt>
            <dd className="mt-1 font-mono text-sm text-slate-900">true</dd>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-amber-700">npm publishing</dt>
            <dd className="mt-1 text-sm font-semibold text-amber-900">Disabled for now</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Package publishing is planned for a future release.
        </p>
      </section>

      {/* 3. Quick start */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-quickstart-heading">
        <h2 id="sdk-quickstart-heading" className="text-lg font-bold text-slate-900">
          Quick start
        </h2>
        <CodeBlock code={QUICK_START_SAMPLE} />

        <div className="mt-5 rounded-xl border border-slate-200 bg-white/80 p-4">
          <h3 className="text-sm font-bold text-slate-900">Try it live (sandbox)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Runs <code className="rounded bg-slate-100 px-1">client.ping()</code> against{" "}
            <code className="rounded bg-slate-100 px-1">/api/developer/ping</code>. Your key is held
            in memory only. Generate one under{" "}
            <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
              API Credentials
            </Link>
            .
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="sdk_api_key" className={labelClass}>
                Sandbox API key
              </label>
              <input
                id="sdk_api_key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="tc_test_…"
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => void runPing()}
              disabled={pinging}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {pinging ? "Pinging…" : "Run ping()"}
            </button>
          </div>
          {pingResult ? (
            <pre
              className={`mt-3 overflow-x-auto rounded-lg border p-3 text-xs ${
                pingResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <code>{JSON.stringify(pingResult, null, 2)}</code>
            </pre>
          ) : null}
        </div>
      </section>

      {/* Available APIs */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-apis-heading">
        <h2 id="sdk-apis-heading" className="text-lg font-bold text-slate-900">
          Available APIs
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          The first read-only Developer APIs (Phase 12H). Every call is authenticated, rate-limited,
          and recorded in{" "}
          <Link href="/dev-console/usage" className="font-semibold text-tropicash-green-hover underline">
            API Usage
          </Link>
          .
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          <li className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-slate-700">
            GET /platform-status
          </li>
          <li className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-slate-700">
            GET /supported-currencies
          </li>
          <li className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-slate-700">
            GET /developer/profile
          </li>
        </ul>
        <CodeBlock code={API_METHODS_SAMPLE} />
      </section>

      {/* 4. Webhook verification */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-webhook-heading">
        <h2 id="sdk-webhook-heading" className="text-lg font-bold text-slate-900">
          Webhook verification
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Verify the <code className="rounded bg-slate-100 px-1">X-Tropicash-Signature</code> header
          against the <code className="rounded bg-slate-100 px-1">X-Tropicash-Timestamp</code> and the
          raw body using HMAC-SHA256.
        </p>
        <CodeBlock code={WEBHOOK_SAMPLE} />
      </section>

      {/* 5. Environment */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-env-heading">
        <h2 id="sdk-env-heading" className="text-lg font-bold text-slate-900">
          Environment management
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Sandbox is enabled. Production is reserved and throws a descriptive error until a future
          release.
        </p>
        <CodeBlock code={ENVIRONMENT_SAMPLE} />
      </section>

      {/* Future-ready */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="sdk-future-heading">
        <h2 id="sdk-future-heading" className="text-lg font-bold text-slate-900">
          Future-ready structure
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          These resource namespaces exist as clean extension points. They are not implemented yet and
          will throw a descriptive error if called.
        </p>
        <CodeBlock code={FUTURE_SAMPLE} />
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
          API Credentials
        </Link>
        {" · "}
        <Link href="/dev-console/webhooks" className="font-semibold text-tropicash-green-hover underline">
          Webhooks
        </Link>
        {" · "}
        <Link href="/dev-console/events" className="font-semibold text-tropicash-green-hover underline">
          Event Registry
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
