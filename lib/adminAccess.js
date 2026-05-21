export const ADMIN_EMAILS = ["akimtropicashad@gmail.com"];

export function isAdminUser(user, profile) {
  // Must stay aligned with public.tc_is_admin() (auth.users.email in withdrawal_requests.sql).
  const sessionEmail = (user?.email || "").trim().toLowerCase();
  if (sessionEmail && ADMIN_EMAILS.includes(sessionEmail)) {
    return true;
  }
  const profileEmail = (profile?.email || "").trim().toLowerCase();
  return profileEmail ? ADMIN_EMAILS.includes(profileEmail) : false;
}
