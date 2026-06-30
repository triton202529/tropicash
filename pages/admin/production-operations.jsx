import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import ProductionOperationsDashboard from "../../dashboard/production_operations_dashboard";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "900px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
};

const card = {
  background: "#fff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
  padding: "1.25rem",
};

export default function ProductionOperationsPage() {
  const { user, profile, isAdminFromRpc, loading } = useUser();
  const isAdmin = isAdminUser(user, profile, isAdminFromRpc);
  const [opsData, setOpsData] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/data/operations/production_operations_results.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setOpsData)
      .catch(() => setOpsData(null));
  }, [isAdmin]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>Loading…</div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1>Production operations</h1>
          <p>Admin access required.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.55rem", fontWeight: 800 }}>Production operations</h1>
        <p style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.92rem" }}>
          TLP-006 certification snapshot.{" "}
          <Link href="/admin/launch-readiness" style={{ color: "#0369a1", fontWeight: 600 }}>
            Launch readiness
          </Link>
        </p>
        <div style={card}>
          <ProductionOperationsDashboard
            data={
              opsData
                ? {
                    ...opsData,
                    live_staging_executed: opsData.pass_criteria?.live_staging_e2e ?? false,
                  }
                : undefined
            }
          />
        </div>
        <p style={{ marginTop: "1rem", fontSize: "0.78rem", color: "#64748b" }}>
          Docs: docs/operations/ · Run: node scripts/tlp006-production-operations.mjs
        </p>
      </div>
    </>
  );
}
