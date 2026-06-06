import { supabase } from "./supabaseClient";

export const KYC_BUCKET = "kyc-documents";

export const KYC_DOCUMENT_SLOTS = ["document_front", "document_back", "selfie"];

const SLOT_TO_COLUMN = {
  document_front: "document_front_url",
  document_back: "document_back_url",
  selfie: "selfie_url",
};

const SIGNED_URL_EXPIRY_SECONDS = 300;

const ALLOWED_MIME_PREFIXES = ["image/"];

function assertDocumentSlot(documentSlot) {
  if (!KYC_DOCUMENT_SLOTS.includes(documentSlot)) {
    throw new Error(`Invalid document slot: ${documentSlot}`);
  }
}

function sanitizeExtension(fileName) {
  const ext = String(fileName || "")
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (!ext || ext.length > 8) return "jpg";
  return ext;
}

function assertImageFile(file) {
  if (!file || typeof file !== "object") {
    throw new Error("A file is required.");
  }
  const mime = String(file.type || "").toLowerCase();
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
    throw new Error("Only image files are allowed for KYC documents.");
  }
}

export function kycDocumentDisplayName(storagePath) {
  if (!storagePath) return null;
  const parts = String(storagePath).split("/");
  return parts[parts.length - 1] || storagePath;
}

export function buildKycDocumentPath(userId, documentSlot, fileName) {
  assertDocumentSlot(documentSlot);
  if (!userId) throw new Error("userId is required.");
  const ext = sanitizeExtension(fileName);
  return `${userId}/${documentSlot}.${ext}`;
}

export async function fetchMyKycProfile(userId) {
  if (!userId) {
    return { data: null, error: new Error("userId is required.") };
  }
  const { data, error } = await supabase
    .from("kyc_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return { data: data || null, error };
}

export async function upsertMyKycProfile(profile) {
  if (!profile?.user_id) {
    return { data: null, error: new Error("profile.user_id is required.") };
  }

  const { data: existing, error: fetchError } = await fetchMyKycProfile(profile.user_id);
  if (fetchError) {
    return { data: null, error: fetchError };
  }

  const payload = { ...profile, user_id: profile.user_id };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("kyc_profiles")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    return { data: data || null, error };
  }

  const { data, error } = await supabase.from("kyc_profiles").insert(payload).select("*").maybeSingle();
  return { data: data || null, error };
}

export async function uploadKycDocument({ userId, file, documentSlot }) {
  try {
    assertDocumentSlot(documentSlot);
    assertImageFile(file);
    if (!userId) {
      return { path: null, error: new Error("userId is required.") };
    }

    const path = buildKycDocumentPath(userId, documentSlot, file.name);
    const { error: uploadError } = await supabase.storage.from(KYC_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });

    if (uploadError) {
      return { path: null, error: uploadError };
    }

    const column = SLOT_TO_COLUMN[documentSlot];
    const { error: profileError } = await upsertMyKycProfile({
      user_id: userId,
      [column]: path,
    });

    if (profileError) {
      return { path: null, error: profileError };
    }

    return { path, error: null };
  } catch (err) {
    return { path: null, error: err };
  }
}

export async function createKycDocumentSignedUrl(path) {
  if (!path) {
    return { signedUrl: null, error: new Error("Storage path is required.") };
  }
  const { data, error } = await supabase.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error) {
    return { signedUrl: null, error };
  }
  return { signedUrl: data?.signedUrl || null, error: null };
}

export async function createAdminKycDocumentSignedUrl(path) {
  return createKycDocumentSignedUrl(path);
}

export async function fetchAdminKycProfiles() {
  const { data, error } = await supabase
    .from("kyc_profiles")
    .select(
      "id, user_id, full_legal_name, date_of_birth, country, address_line1, address_line2, city, state_region, postal_code, document_type, document_number_last4, status, created_at, reviewed_at, reviewed_by, review_notes, document_front_url, document_back_url, selfie_url",
    )
    .neq("status", "not_started")
    .order("created_at", { ascending: false })
    .limit(300);
  return { data: Array.isArray(data) ? data : [], error };
}

function isMissingAuditTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42P01" || (msg.includes("kyc_review_events") && msg.includes("does not exist"));
}

export async function fetchKycReviewEvents(kycProfileId) {
  if (!kycProfileId) {
    return { data: [], error: new Error("kycProfileId is required."), auditUnavailable: false };
  }
  const { data, error } = await supabase
    .from("kyc_review_events")
    .select("id, kyc_profile_id, user_id, previous_status, new_status, review_notes, reviewed_by, created_at")
    .eq("kyc_profile_id", kycProfileId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingAuditTable(error)) {
      console.warn("[kyc] review events table unavailable", error.message);
      return { data: [], error: null, auditUnavailable: true };
    }
    return { data: [], error, auditUnavailable: false };
  }
  return { data: Array.isArray(data) ? data : [], error: null, auditUnavailable: false };
}

export async function createKycReviewEvent({
  kycProfileId,
  userId,
  previousStatus,
  newStatus,
  reviewNotes,
  reviewedBy,
}) {
  if (!kycProfileId || !userId || !newStatus) {
    return { data: null, error: new Error("kycProfileId, userId, and newStatus are required.") };
  }
  const payload = {
    kyc_profile_id: kycProfileId,
    user_id: userId,
    previous_status: previousStatus || null,
    new_status: newStatus,
    review_notes: String(reviewNotes || "").trim() || null,
    reviewed_by: reviewedBy || null,
  };
  const { data, error } = await supabase.from("kyc_review_events").insert(payload).select("*").maybeSingle();
  if (error) {
    if (isMissingAuditTable(error)) {
      console.warn("[kyc] review event insert skipped — audit table unavailable", error.message);
      return { data: null, error: null, auditUnavailable: true };
    }
    return { data: null, error, auditUnavailable: false };
  }
  return { data: data || null, error: null, auditUnavailable: false };
}

/**
 * TODO(notifications): wire KYC outcome notifications when notification pipeline supports
 * transactional identity events — approved, rejected, needs_more_info.
 */
export async function updateKycReviewStatus({
  kycProfileId,
  userId,
  status,
  reviewNotes,
  reviewedBy,
  previousStatus,
}) {
  if (!kycProfileId || !userId || !status || !reviewedBy) {
    return {
      data: null,
      error: new Error("kycProfileId, userId, status, and reviewedBy are required."),
      auditUnavailable: false,
    };
  }

  let priorStatus = previousStatus;
  if (priorStatus == null) {
    const { data: profile, error: fetchError } = await supabase
      .from("kyc_profiles")
      .select("status")
      .eq("id", kycProfileId)
      .maybeSingle();
    if (fetchError) {
      return { data: null, error: fetchError, auditUnavailable: false };
    }
    priorStatus = profile?.status || null;
  }

  const trimmedNotes = String(reviewNotes || "").trim() || null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("kyc_profiles")
    .update({
      status,
      review_notes: trimmedNotes,
      reviewed_by: reviewedBy,
      reviewed_at: now,
    })
    .eq("id", kycProfileId)
    .select("*")
    .maybeSingle();

  if (error) {
    return { data: null, error, auditUnavailable: false };
  }

  const auditResult = await createKycReviewEvent({
    kycProfileId,
    userId,
    previousStatus: priorStatus,
    newStatus: status,
    reviewNotes: trimmedNotes,
    reviewedBy,
  });

  return {
    data: data || null,
    error: null,
    auditUnavailable: auditResult.auditUnavailable,
  };
}

