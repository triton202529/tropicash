import { useEffect, useState } from "react";

import { isAdminUser } from "./adminAccess";
import { userHasDeveloperConsoleAccess } from "./developerAccessGate";

export const DEVELOPER_NAV_PUBLIC = "/developers";
export const DEVELOPER_NAV_CONSOLE = "/dev-console";

/**
 * Resolve Developers navbar / menu destination (no duplicate gate logic).
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 * @param {object | null | undefined} profile
 * @param {boolean} authLoading
 * @returns {Promise<string>}
 */
export async function resolveDeveloperNavHref(user, profile, authLoading) {
  if (authLoading || !user) {
    return DEVELOPER_NAV_PUBLIC;
  }
  if (isAdminUser(user, profile)) {
    return DEVELOPER_NAV_CONSOLE;
  }
  const result = await userHasDeveloperConsoleAccess(user, profile);
  return result.allowed ? DEVELOPER_NAV_CONSOLE : DEVELOPER_NAV_PUBLIC;
}

/**
 * Access-aware Developers link target for global nav.
 * Defaults to /developers until auth and the console gate resolve (avoids href flicker).
 *
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 * @param {object | null | undefined} profile
 * @param {boolean} authLoading
 * @returns {{ href: string; checking: boolean }}
 */
export function useDeveloperNavHref(user, profile, authLoading) {
  const [href, setHref] = useState(DEVELOPER_NAV_PUBLIC);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (authLoading) {
      setHref(DEVELOPER_NAV_PUBLIC);
      setChecking(false);
      return;
    }
    if (!user) {
      setHref(DEVELOPER_NAV_PUBLIC);
      setChecking(false);
      return;
    }
    if (isAdminUser(user, profile)) {
      setHref(DEVELOPER_NAV_CONSOLE);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setHref(DEVELOPER_NAV_PUBLIC);
    setChecking(true);

    void userHasDeveloperConsoleAccess(user, profile).then((result) => {
      if (cancelled) return;
      setHref(result.allowed ? DEVELOPER_NAV_CONSOLE : DEVELOPER_NAV_PUBLIC);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, profile, authLoading]);

  return { href, checking };
}
