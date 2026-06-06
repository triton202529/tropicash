import { supabase } from './supabaseClient';

/**
 * Tropicash Developer Center — Phase 12E developer event registry (read-only).
 *
 * The registry is the single source of truth for events that can be emitted via
 * webhooks, APIs, notifications, and future integrations. This module is
 * intentionally READ-ONLY — there are no mutation functions. Admin authoring
 * controls arrive in a future phase. RLS scopes `internal` events to admins.
 */

const TABLE = 'developer_event_registry';

const VISIBLE_COLUMNS =
  'id, event_name, category, description, status, sample_payload, available_since, created_at, updated_at';

export const EVENT_CATEGORIES = [
  'wallet',
  'kyc',
  'developer',
  'account',
  'triton',
  'system',
];

export const EVENT_STATUSES = ['available', 'planned', 'internal'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validationError(message) {
  return { data: null, error: { message, code: 'validation_error' } };
}

/**
 * Fetch all visible events, ordered by category then event name.
 * RLS hides `internal` events from non-admins.
 *
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperEvents() {
  const { data, error } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .order('category', { ascending: true })
    .order('event_name', { ascending: true });
  return { data, error };
}

/**
 * Fetch a single event by its unique event name.
 *
 * @param {string} eventName
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function fetchDeveloperEvent(eventName) {
  if (!isNonEmptyString(eventName)) {
    return validationError('An event name is required.');
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('event_name', eventName.trim())
    .maybeSingle();
  return { data, error };
}

/**
 * Fetch events filtered by category.
 *
 * @param {string} category
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchEventsByCategory(category) {
  if (!EVENT_CATEGORIES.includes(String(category || '').trim())) {
    return validationError('A valid category is required.');
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('category', String(category).trim())
    .order('event_name', { ascending: true });
  return { data, error };
}

/**
 * Fetch events filtered by status.
 *
 * @param {string} status
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchEventsByStatus(status) {
  if (!EVENT_STATUSES.includes(String(status || '').trim())) {
    return validationError('A valid status is required.');
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('status', String(status).trim())
    .order('event_name', { ascending: true });
  return { data, error };
}
