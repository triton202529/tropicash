import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { fetchAllSandboxApplications } from "../../lib/developerSandboxApplications";
import {
  fetchAllSandboxAgreements,
  SANDBOX_AGREEMENT_VERSIONS,
} from "../../lib/developerSandboxAgreements";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1400px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const inputBase = {
  padding: "0.65rem 0.8rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "220px",
  background: "#f4f6f9",
  color: "#0f172a",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function parseDateStart(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(value) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function DeveloperSandboxAgreementsAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [agreements, setAgreements] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [versionFilter, setVersionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [developerQuery, setDeveloperQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [agreementsRes, appsRes] = await Promise.all([
      fetchAllSandboxAgreements(),
      fetchAllSandboxApplications(),
    ]);
    if (agreementsRes.error) {
      setError(agreementsRes.error.message || "Failed to load agreements.");
      setAgreements([]);
    } else {
      setAgreements(Array.isArray(agreementsRes.data) ? agreementsRes.data : []);
    }
    setApplications(appsRes.error ? [] : appsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    void load();
  }, [user, userLoading, isAdmin, router, load]);

  const appById = useMemo(
    () => Object.fromEntries((applications || []).map((a) => [a.id, a])),
    [applications],
  );

  const filtered = useMemo(() => {
    const from = parseDateStart(dateFrom);
    const to = parseDateEnd(dateTo);
    const q = developerQuery.trim().toLowerCase();

    return agreements.filter((row) => {
      if (versionFilter !== "all" && row.agreement_version !== versionFilter) return false;
      const acceptedAt = row.accepted_at ? new Date(row.accepted_at) : null;
      if (from && acceptedAt && acceptedAt < from) return false;
      if (to && acceptedAt && acceptedAt > to) return false;

      const app = row.application_id ? appById[row.application_id] : null;
      if (q) {
        const haystack = [
          app?.developer_name,
          app?.organization_name,
          app?.email,
          row.user_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [agreements, versionFilter, dateFrom, dateTo, developerQuery, appById]);

  if (userLoading || !user || !isAdmin) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin
          </Link>
          {" · "}
          <Link
            href="/admin/developer-sandbox-applications"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Sandbox applications
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          Developer Sandbox Agreements
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "820px", lineHeight: 1.5 }}>
          Read-only audit trail of sandbox agreement acceptances. Records are immutable.
        </p>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                Agreement version
              </label>
              <select
                value={versionFilter}
                onChange={(e) => setVersionFilter(e.target.value)}
                style={{ ...inputBase, cursor: "pointer", marginTop: "0.35rem" }}
              >
                <option value="all">All versions</option>
                {SANDBOX_AGREEMENT_VERSIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                From date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ ...inputBase, marginTop: "0.35rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                To date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ ...inputBase, marginTop: "0.35rem" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                Developer search
              </label>
              <input
                type="search"
                value={developerQuery}
                onChange={(e) => setDeveloperQuery(e.target.value)}
                placeholder="Name, org, email…"
                style={{ ...inputBase, marginTop: "0.35rem", maxWidth: "280px" }}
              />
            </div>
          </div>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
            Showing {filtered.length} of {agreements.length} acceptance records
          </p>
        </div>

        {error ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ ...cardBase, overflow: "hidden" }}>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No agreement records match filters.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Developer</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Organization</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Version</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Accepted at</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>IP address</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>User agent</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const app = row.application_id ? appById[row.application_id] : null;
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div>{app?.developer_name || "—"}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                            {app?.email || row.user_id}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>{app?.organization_name || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                          {row.agreement_version}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          {formatWhen(row.accepted_at)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {row.accepted_ip || "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontSize: "0.72rem",
                            color: "#64748b",
                            maxWidth: "280px",
                            wordBreak: "break-word",
                          }}
                        >
                          {row.accepted_user_agent || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
          Run{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            supabase/sql/developer_sandbox_agreements_phase14d.sql
          </code>{" "}
          if the agreement table is missing.
        </p>
      </div>
    </>
  );
}
