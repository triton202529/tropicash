export const ADMIN_EMAILS = ["akimtropicashad@gmail.com"];

export function isAdminUser(user, profile) {
  const email = user?.email || profile?.email || "";

  return ADMIN_EMAILS.includes(email.toLowerCase());
}
