import { supabase } from "./supabaseClient";

import { isAdminUser } from "./adminAccess";

import { DEVELOPER_ACCESS_REQUESTS_TABLE } from "./developerCenterConfig";



const TABLE = DEVELOPER_ACCESS_REQUESTS_TABLE;

const DEBUG_PREFIX = "[dev-access-debug]";



export const DEVELOPER_CONSOLE_ACCESS_MESSAGES = {

  pending: "Developer access is pending review.",

  rejected: "Developer access was not approved.",

  none: "Request developer access first.",

};



/** @param {string | null | undefined} email */

export function normalizeDeveloperEmail(email) {

  return (email || "").trim().toLowerCase();

}



/** @param {string | null | undefined} status */

export function normalizeDeveloperAccessStatus(status) {

  return String(status || "").trim().toLowerCase();

}



function validationError(message) {

  return { data: null, error: { message, code: "validation_error" } };

}



function devAccessDebug(label, payload) {

  if (typeof console !== "undefined" && console.log) {

    console.log(`${DEBUG_PREFIX} ${label}`, payload);

  }

}



/** @param {string} pathname */

export function isDevConsoleRoute(pathname) {

  return pathname === "/dev-console" || pathname.startsWith("/dev-console/");

}



/**

 * Rows visible to the signed-in user (RLS: own email or admin).

 * Does not filter by status — caller matches approved / latest in JS.

 * @returns {Promise<{ data: object[]; error: object | null }>}

 */

export async function fetchDeveloperAccessRequestsForSession() {

  const {

    data: { session },

    error: sessionError,

  } = await supabase.auth.getSession();



  if (sessionError) {

    return { data: [], error: sessionError };

  }

  if (!session?.user) {

    return validationError("not authenticated.");

  }



  const { data, error } = await supabase

    .from(TABLE)

    .select("*")

    .order("created_at", { ascending: false });



  return { data: data || [], error };

}



/**

 * Rows for an email, normalized on both sides (case/trim).

 * @param {object[]} rows

 * @param {string} email

 */

export function filterDeveloperAccessRowsForEmail(rows, email) {

  const normalized = normalizeDeveloperEmail(email);

  if (!normalized) return [];

  return (rows || []).filter(

    (row) => normalizeDeveloperEmail(row?.email) === normalized,

  );

}



/**

 * Latest approved row for an email (case-insensitive email, normalized status).

 * @param {string} email

 * @returns {Promise<{ data: object | null; error: object | null }>}

 */

export async function fetchApprovedDeveloperAccessForEmail(email) {

  const { data: rows, error } = await fetchDeveloperAccessRequestsForSession();

  if (error) {

    return { data: null, error };

  }



  const matching = filterDeveloperAccessRowsForEmail(rows, email);

  const approved = matching.find(

    (row) => normalizeDeveloperAccessStatus(row.status) === "approved",

  );



  return { data: approved || null, error: null };

}



/**

 * Latest access request row for an email (any status).

 * @param {string} email

 * @returns {Promise<{ data: object | null; error: object | null }>}

 */

export async function fetchLatestDeveloperAccessRequestForEmail(email) {

  const { data: rows, error } = await fetchDeveloperAccessRequestsForSession();

  if (error) {

    return { data: null, error };

  }



  const matching = filterDeveloperAccessRowsForEmail(rows, email);

  return { data: matching[0] || null, error: null };

}



function reasonFromRequestStatus(status) {

  const s = normalizeDeveloperAccessStatus(status);

  if (s === "approved") {

    return null;

  }

  if (s === "pending" || s === "reviewed") {

    return DEVELOPER_CONSOLE_ACCESS_MESSAGES.pending;

  }

  if (s === "rejected") {

    return DEVELOPER_CONSOLE_ACCESS_MESSAGES.rejected;

  }

  return DEVELOPER_CONSOLE_ACCESS_MESSAGES.none;

}



/**

 * Resolve console access from fetched rows (pure — easy to test).

 * @param {object[]} rows

 * @param {string} email

 * @returns {{ allowed: boolean; reason: string | null; request: object | null }}

 */

export function resolveDeveloperConsoleAccessFromRows(rows, email) {

  const matching = filterDeveloperAccessRowsForEmail(rows, email);

  const approved = matching.find(

    (row) => normalizeDeveloperAccessStatus(row.status) === "approved",

  );



  if (approved) {

    return { allowed: true, reason: null, request: approved };

  }



  const latest = matching[0] || null;

  if (!latest) {

    return {

      allowed: false,

      reason: DEVELOPER_CONSOLE_ACCESS_MESSAGES.none,

      request: null,

    };

  }



  const latestStatus = normalizeDeveloperAccessStatus(latest.status);

  if (latestStatus === "approved") {

    return { allowed: true, reason: null, request: latest };

  }



  return {

    allowed: false,

    reason: reasonFromRequestStatus(latest.status),

    request: latest,

  };

}



/**

 * Whether the signed-in user may enter /dev-console/* (session + approval gate).

 * Admins always allowed. Approval grants console entry only — not orgs/apps/keys.

 *

 * @param {import('@supabase/supabase-js').User | null | undefined} user

 * @param {object | null | undefined} profile

 * @returns {Promise<{ allowed: boolean; reason: string | null; request: object | null }>}

 */

export async function userHasDeveloperConsoleAccess(user, profile) {

  const authEmail = user?.email ?? null;

  const profileEmail = profile?.email ?? null;

  const email = normalizeDeveloperEmail(authEmail || profileEmail);



  if (isAdminUser(user, profile)) {

    devAccessDebug("admin bypass", { authEmail, normalizedEmail: email });

    return { allowed: true, reason: null, request: null };

  }



  if (!email) {

    devAccessDebug("no email", { authEmail, profileEmail, allowed: false });

    return {

      allowed: false,

      reason: DEVELOPER_CONSOLE_ACCESS_MESSAGES.none,

      request: null,

    };

  }



  const { data: rows, error } = await fetchDeveloperAccessRequestsForSession();



  const matching = filterDeveloperAccessRowsForEmail(rows, email);

  const result = resolveDeveloperConsoleAccessFromRows(rows, email);



  devAccessDebug("gate", {

    authEmail,

    profileEmail,

    normalizedEmail: email,

    fetchError: error?.message ?? null,

    rowCount: rows?.length ?? 0,

    matchingCount: matching.length,

    rows: matching.map((row) => ({

      id: row.id,

      email: row.email,

      status: row.status,

      created_at: row.created_at,

    })),

    matchedRequestId: result.request?.id ?? null,

    matchedStatus: result.request?.status ?? null,

    allowed: result.allowed,

    reason: result.reason,

  });



  if (error) {

    return {

      allowed: false,

      reason: DEVELOPER_CONSOLE_ACCESS_MESSAGES.none,

      request: null,

    };

  }



  return result;

}


