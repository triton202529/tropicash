import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import {
  fetchMyKycProfile,
  kycDocumentDisplayName,
  uploadKycDocument,
  upsertMyKycProfile,
} from "../lib/kyc";
import { useUser } from "../lib/userContext";

const pageWrap = {
  padding: "1.75rem 1.25rem 3.5rem",
  maxWidth: "720px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "0.9rem",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "0.35rem",
};

const DOCUMENT_TYPES = [
  { value: "", label: "Select document type" },
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's license" },
  { value: "other", label: "Other government ID" },
];

const STATUS_COPY = {
  not_started: "Verification not started",
  submitted: "Submitted for review",
  under_review: "Under review",
  approved: "Verified",
  rejected: "Rejected",
  needs_more_info: "More information needed",
};

const DOCUMENT_UPLOADS = [
  { slot: "document_front", label: "Government ID — front", id: "kyc-doc-front" },
  { slot: "document_back", label: "Government ID — back", id: "kyc-doc-back", hint: "Optional if not applicable" },
  { slot: "selfie", label: "Selfie / liveness image", id: "kyc-doc-selfie" },
];

function emptyUploadState() {
  return {
    document_front: { status: "idle", fileName: null, error: null },
    document_back: { status: "idle", fileName: null, error: null },
    selfie: { status: "idle", fileName: null, error: null },
  };
}

function uploadStateFromProfile(row) {
  const next = emptyUploadState();
  if (!row) return next;
  for (const { slot } of DOCUMENT_UPLOADS) {
    const col =
      slot === "document_front"
        ? row.document_front_url
        : slot === "document_back"
          ? row.document_back_url
          : row.selfie_url;
    if (col) {
      next[slot] = {
        status: "uploaded",
        fileName: kycDocumentDisplayName(col),
        error: null,
      };
    }
  }
  return next;
}

function statusBadgeStyle(status) {
  const key = String(status || "not_started").toLowerCase();
  if (key === "approved") {
    return { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
  }
  if (key === "rejected") {
    return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" };
  }
  if (key === "needs_more_info") {
    return { background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" };
  }
  if (key === "under_review" || key === "submitted") {
    return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  }
  return { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" };
}

function emptyForm() {
  return {
    full_legal_name: "",
    date_of_birth: "",
    country: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state_region: "",
    postal_code: "",
    document_type: "",
    document_number_last4: "",
  };
}

function rowToForm(row) {
  if (!row) return emptyForm();
  return {
    full_legal_name: row.full_legal_name || "",
    date_of_birth: row.date_of_birth || "",
    country: row.country || "",
    address_line1: row.address_line1 || "",
    address_line2: row.address_line2 || "",
    city: row.city || "",
    state_region: row.state_region || "",
    postal_code: row.postal_code || "",
    document_type: row.document_type || "",
    document_number_last4: row.document_number_last4 || "",
  };
}

export default function KycPage() {
  const { user, loading: authLoading } = useUser();
  const [profileRow, setProfileRow] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [uploadState, setUploadState] = useState(emptyUploadState());

  const status = String(profileRow?.status || "not_started").toLowerCase();
  const canEdit = ["not_started", "rejected", "needs_more_info"].includes(status);
  const editingDisabled = !canEdit;
  const isUnderReview = status === "submitted" || status === "under_review";
  const isApproved = status === "approved";
  const showReviewerNote = (status === "rejected" || status === "needs_more_info") && profileRow?.review_notes;
  const statusLabel = STATUS_COPY[status] || STATUS_COPY.not_started;

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await fetchMyKycProfile(user.id);
    if (error) {
      console.error("[kyc] load", error);
      setErrorMsg(error.message || "Could not load verification profile.");
      setProfileRow(null);
      setForm(emptyForm());
      setUploadState(emptyUploadState());
      setLoading(false);
      return;
    }
    setProfileRow(data || null);
    setForm(rowToForm(data));
    setUploadState(uploadStateFromProfile(data));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    void loadProfile();
  }, [authLoading, user?.id, loadProfile]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccessMsg(null);
  };

  const validate = () => {
    if (!String(form.full_legal_name || "").trim()) {
      return "Full legal name is required.";
    }
    if (!form.date_of_birth) {
      return "Date of birth is required.";
    }
    if (!String(form.country || "").trim()) {
      return "Country is required.";
    }
    if (!String(form.address_line1 || "").trim()) {
      return "Address line 1 is required.";
    }
    if (!String(form.city || "").trim()) {
      return "City is required.";
    }
    if (!String(form.document_type || "").trim()) {
      return "Document type is required.";
    }
    const last4 = String(form.document_number_last4 || "").replace(/\D/g, "");
    if (last4.length !== 4) {
      return "Document number (last 4 digits) must be exactly 4 digits.";
    }
    if (uploadState.document_front.status !== "uploaded") {
      return "Government ID front photo is required.";
    }
    if (uploadState.selfie.status !== "uploaded") {
      return "Selfie / liveness image is required.";
    }
    return null;
  };

  const handleDocumentSelect = async (documentSlot, fileList) => {
    if (editingDisabled || !user?.id) return;
    const file = fileList?.[0];
    if (!file) return;

    setUploadState((prev) => ({
      ...prev,
      [documentSlot]: { status: "uploading", fileName: file.name, error: null },
    }));
    setErrorMsg(null);
    setSuccessMsg(null);

    const { path, error } = await uploadKycDocument({ userId: user.id, file, documentSlot });
    if (error) {
      console.error("[kyc] upload", documentSlot, error);
      setUploadState((prev) => ({
        ...prev,
        [documentSlot]: {
          status: "error",
          fileName: file.name,
          error: error.message || "Upload failed.",
        },
      }));
      return;
    }

    setUploadState((prev) => ({
      ...prev,
      [documentSlot]: {
        status: "uploaded",
        fileName: kycDocumentDisplayName(path) || file.name,
        error: null,
      },
    }));
    await loadProfile();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingDisabled || !user?.id) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_legal_name: String(form.full_legal_name).trim(),
      date_of_birth: form.date_of_birth || null,
      country: String(form.country).trim(),
      address_line1: String(form.address_line1).trim(),
      address_line2: String(form.address_line2 || "").trim() || null,
      city: String(form.city).trim(),
      state_region: String(form.state_region || "").trim() || null,
      postal_code: String(form.postal_code || "").trim() || null,
      document_type: String(form.document_type).trim(),
      document_number_last4: String(form.document_number_last4).replace(/\D/g, "").slice(-4),
      status: "submitted",
    };

    const { error } = await upsertMyKycProfile(payload);

    if (error) {
      console.error("[kyc] submit", error);
      setErrorMsg(error.message || "Could not submit verification.");
      setSaving(false);
      return;
    }
    setSuccessMsg("Your verification details were submitted for review.");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        await fetch("/api/compliance/queue-screening", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subject_name: payload.full_legal_name }),
        });
      }
    } catch (screenErr) {
      console.warn("[kyc] compliance screening queue failed:", screenErr);
    }
    await loadProfile();
    setSaving(false);
  };

  const badgeStyle = useMemo(() => statusBadgeStyle(status), [status]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Sign in to verify your identity.</p>
          <Link href="/login" style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <h1
          style={{
            fontSize: "1.55rem",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Verify identity
        </h1>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.55 }}>
          Submit your legal identity details for manual review. Wallet features are not blocked during this preview
          phase.
        </p>

        <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Status
          </span>
          <div style={{ marginTop: "0.45rem" }}>
            <span
              style={{
                display: "inline-block",
                padding: "0.25rem 0.6rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 700,
                ...badgeStyle,
              }}
            >
              {statusLabel}
            </span>
          </div>
          {isUnderReview ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#1d4ed8", lineHeight: 1.5 }}>
              Your verification is being reviewed. You cannot edit your submission while it is in progress.
            </p>
          ) : null}
          {isApproved ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#047857", lineHeight: 1.5 }}>
              Your identity is verified. Contact support if you need to update your details.
            </p>
          ) : null}
          {showReviewerNote ? (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.65rem 0.75rem",
                borderRadius: "8px",
                background: status === "rejected" ? "#fef2f2" : "#fffbeb",
                border: `1px solid ${status === "rejected" ? "#fecaca" : "#fcd34d"}`,
              }}
            >
              <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                {status === "rejected" ? "Verification rejected" : "More information requested"}
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
                {profileRow.review_notes}
              </p>
              {canEdit ? (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
                  Update your details below and resubmit for review.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {errorMsg ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        {successMsg ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              background: "#ecfdf5",
              borderColor: "#a7f3d0",
            }}
          >
            <p style={{ margin: 0, color: "#047857", fontSize: "0.9rem" }}>{successMsg}</p>
          </div>
        ) : null}

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading your profile…</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} style={{ ...cardBase, padding: "1.25rem 1.1rem" }}>
            <fieldset disabled={editingDisabled || saving} style={{ border: "none", margin: 0, padding: 0 }}>
              <div style={{ display: "grid", gap: "1rem" }}>
                <div>
                  <label style={labelStyle} htmlFor="kyc-full-name">
                    Full legal name
                  </label>
                  <input
                    id="kyc-full-name"
                    type="text"
                    value={form.full_legal_name}
                    onChange={(e) => setField("full_legal_name", e.target.value)}
                    style={inputStyle}
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="kyc-dob">
                    Date of birth
                  </label>
                  <input
                    id="kyc-dob"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setField("date_of_birth", e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="kyc-country">
                    Country
                  </label>
                  <input
                    id="kyc-country"
                    type="text"
                    value={form.country}
                    onChange={(e) => setField("country", e.target.value)}
                    style={inputStyle}
                    autoComplete="country-name"
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="kyc-addr1">
                    Address line 1
                  </label>
                  <input
                    id="kyc-addr1"
                    type="text"
                    value={form.address_line1}
                    onChange={(e) => setField("address_line1", e.target.value)}
                    style={inputStyle}
                    autoComplete="address-line1"
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="kyc-addr2">
                    Address line 2 (optional)
                  </label>
                  <input
                    id="kyc-addr2"
                    type="text"
                    value={form.address_line2}
                    onChange={(e) => setField("address_line2", e.target.value)}
                    style={inputStyle}
                    autoComplete="address-line2"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <label style={labelStyle} htmlFor="kyc-city">
                      City
                    </label>
                    <input
                      id="kyc-city"
                      type="text"
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                      style={inputStyle}
                      autoComplete="address-level2"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="kyc-state">
                      State / region
                    </label>
                    <input
                      id="kyc-state"
                      type="text"
                      value={form.state_region}
                      onChange={(e) => setField("state_region", e.target.value)}
                      style={inputStyle}
                      autoComplete="address-level1"
                    />
                  </div>
                  <div>
                    <label style={labelStyle} htmlFor="kyc-postal">
                      Postal code
                    </label>
                    <input
                      id="kyc-postal"
                      type="text"
                      value={form.postal_code}
                      onChange={(e) => setField("postal_code", e.target.value)}
                      style={inputStyle}
                      autoComplete="postal-code"
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle} htmlFor="kyc-doc-type">
                    Document type
                  </label>
                  <select
                    id="kyc-doc-type"
                    value={form.document_type}
                    onChange={(e) => setField("document_type", e.target.value)}
                    style={inputStyle}
                  >
                    {DOCUMENT_TYPES.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle} htmlFor="kyc-last4">
                    Document number (last 4 digits)
                  </label>
                  <input
                    id="kyc-last4"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.document_number_last4}
                    onChange={(e) =>
                      setField("document_number_last4", e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    style={inputStyle}
                    placeholder="1234"
                  />
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                >
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                    Identity documents
                  </p>
                  <p style={{ margin: "0 0 0.85rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>
                    Upload clear photos of your ID and a selfie. Files are stored privately and are not publicly
                    accessible.
                  </p>
                  <div style={{ display: "grid", gap: "0.85rem" }}>
                    {DOCUMENT_UPLOADS.map(({ slot, label, id, hint }) => {
                      const slotState = uploadState[slot] || emptyUploadState()[slot];
                      const isUploading = slotState.status === "uploading";
                      const isUploaded = slotState.status === "uploaded";
                      const isError = slotState.status === "error";
                      return (
                        <div
                          key={slot}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                          }}
                        >
                          <label style={{ ...labelStyle, marginBottom: "0.25rem" }} htmlFor={id}>
                            {label}
                            {slot === "document_back" ? " (optional)" : " *"}
                          </label>
                          {hint ? (
                            <p style={{ margin: "0 0 0.35rem", fontSize: "0.72rem", color: "#94a3b8" }}>{hint}</p>
                          ) : null}
                          <input
                            id={id}
                            type="file"
                            accept="image/*"
                            capture={slot === "selfie" ? "user" : "environment"}
                            disabled={editingDisabled || saving || isUploading}
                            onChange={(e) => {
                              void handleDocumentSelect(slot, e.target.files);
                              e.target.value = "";
                            }}
                            style={{ ...inputStyle, padding: "0.4rem", fontSize: "0.82rem" }}
                          />
                          <p
                            style={{
                              margin: "0.35rem 0 0",
                              fontSize: "0.75rem",
                              color: isError ? "#b91c1c" : isUploaded ? "#047857" : "#64748b",
                            }}
                          >
                            {isUploading
                              ? "Uploading…"
                              : isError
                                ? slotState.error || "Upload failed."
                                : isUploaded
                                  ? `On file: ${slotState.fileName}`
                                  : "No file uploaded yet"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {!editingDisabled ? (
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    marginTop: "1.25rem",
                    width: "100%",
                    padding: "0.65rem 1rem",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: saving ? "wait" : "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving
                    ? "Submitting…"
                    : status === "rejected" || status === "needs_more_info"
                      ? "Update & resubmit for review"
                      : profileRow
                        ? "Update & submit for review"
                        : "Submit for review"}
                </button>
              ) : isUnderReview ? (
                <p style={{ marginTop: "1.25rem", fontSize: "0.85rem", color: "#64748b" }}>
                  Your submission is locked while under review.
                </p>
              ) : isApproved ? (
                <p style={{ marginTop: "1.25rem", fontSize: "0.85rem", color: "#64748b" }}>
                  Verified — editing is disabled.
                </p>
              ) : null}
            </fieldset>
          </form>
        )}
      </div>
    </>
  );
}
