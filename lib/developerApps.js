import { supabase } from './supabaseClient';

const ORG_TYPES = new Set(['individual', 'business', 'platform', 'internal']);
const APP_TYPES = new Set(['web', 'mobile', 'server', 'internal', 'other']);
const APP_ENVIRONMENTS = new Set(['sandbox', 'live']);

const ORGS_TABLE = 'developer_organizations';
const APPS_TABLE = 'developer_apps';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

/**
 * URL-safe slug from a display name (pure function).
 * @param {string} name
 * @returns {string}
 */
export function slugifyAppName(name) {
  const raw = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return raw || 'app';
}

function validationError(message) {
  return { data: null, error: { message, code: 'validation_error' } };
}

/**
 * @param {string} userId
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperOrganizations(userId) {
  if (!isUuidLike(userId)) {
    return validationError('A valid user id is required.');
  }
  const { data, error } = await supabase
    .from(ORGS_TABLE)
    .select('*')
    .eq('owner_user_id', userId.trim())
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * @param {{
 *   owner_user_id: string;
 *   organization_name: string;
 *   organization_type?: string;
 *   website_url?: string | null;
 *   contact_email?: string | null;
 *   description?: string | null;
 * }} payload
 */
export async function createDeveloperOrganization(payload) {
  const owner_user_id = payload?.owner_user_id;
  const organization_name = payload?.organization_name;

  if (!isUuidLike(owner_user_id)) {
    return validationError('owner_user_id must be a valid UUID.');
  }
  if (!isNonEmptyString(organization_name)) {
    return validationError('organization_name is required.');
  }

  const organization_type =
    ORG_TYPES.has(String(payload?.organization_type || '').trim())
      ? String(payload.organization_type).trim()
      : 'business';

  const row = {
    owner_user_id: owner_user_id.trim(),
    organization_name: organization_name.trim(),
    organization_type,
    website_url: isNonEmptyString(payload?.website_url) ? String(payload.website_url).trim() : null,
    contact_email: isNonEmptyString(payload?.contact_email) ? String(payload.contact_email).trim() : null,
    description: isNonEmptyString(payload?.description) ? String(payload.description).trim() : null,
  };

  const { data, error } = await supabase.from(ORGS_TABLE).insert(row).select('*').single();
  return { data, error };
}

/**
 * @param {string} userId
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperApps(userId) {
  if (!isUuidLike(userId)) {
    return validationError('A valid user id is required.');
  }
  const { data, error } = await supabase
    .from(APPS_TABLE)
    .select('*')
    .eq('owner_user_id', userId.trim())
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * @param {{
 *   organization_id: string;
 *   owner_user_id: string;
 *   app_name: string;
 *   app_slug: string;
 *   environment?: string;
 *   app_type?: string;
 *   description?: string | null;
 *   redirect_url?: string | null;
 * }} payload
 */
export async function createDeveloperApp(payload) {
  const organization_id = payload?.organization_id;
  const owner_user_id = payload?.owner_user_id;
  const app_name = payload?.app_name;
  const app_slug = payload?.app_slug;

  if (!isUuidLike(organization_id)) {
    return validationError('organization_id must be a valid UUID.');
  }
  if (!isUuidLike(owner_user_id)) {
    return validationError('owner_user_id must be a valid UUID.');
  }
  if (!isNonEmptyString(app_name)) {
    return validationError('app_name is required.');
  }
  if (!isNonEmptyString(app_slug)) {
    return validationError('app_slug is required.');
  }

  const slug = String(app_slug).trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return validationError('app_slug must be lowercase letters, numbers, and single hyphens only.');
  }

  const environment = APP_ENVIRONMENTS.has(String(payload?.environment || '').trim())
    ? String(payload.environment).trim()
    : 'sandbox';

  const app_type = APP_TYPES.has(String(payload?.app_type || '').trim())
    ? String(payload.app_type).trim()
    : 'web';

  const row = {
    organization_id: organization_id.trim(),
    owner_user_id: owner_user_id.trim(),
    app_name: app_name.trim(),
    app_slug: slug,
    environment,
    status: 'draft',
    app_type,
    description: isNonEmptyString(payload?.description) ? String(payload.description).trim() : null,
    redirect_url: isNonEmptyString(payload?.redirect_url) ? String(payload.redirect_url).trim() : null,
  };

  const { data, error } = await supabase.from(APPS_TABLE).insert(row).select('*').single();
  return { data, error };
}
