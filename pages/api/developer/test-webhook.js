import { requireDeveloperApiAuth } from '../../../lib/developerApiAuth';
import { createSupabaseServiceClient } from '../../../lib/supabaseAdminApi';
import { sendDeveloperWebhookTestEvent } from '../../../lib/developerWebhooks';
import { sendApiError, sendApiSuccess, sendMethodNotAllowed } from '../../../lib/developerApiResponses';

const WEBHOOK_TEST_FAILED = 'Webhook test failed';

/**
 * POST /api/developer/test-webhook
 *
 * Sends a signed test event to one of the authenticated app's webhook endpoints.
 *
 * Pipeline (Phase 12B + 12C + 12D):
 *   1. Authenticate the sandbox API credential (Bearer tc_test_...).
 *   2. Enforce the rate limit (HTTP 429 when exceeded).
 *   3. Record the request in developer_api_usage_logs.
 *   4. Confirm the webhook belongs to the authenticated organization + app.
 *   5. Deliver a signed test payload (X-Tropicash-Signature / -Timestamp).
 *
 * No money movement or real payment events.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  // Gates 1-3: auth + rate limit + usage logging.
  const context = await requireDeveloperApiAuth(req, res, {
    endpoint: '/api/developer/test-webhook',
    method: 'POST',
  });
  if (!context) {
    // 401 (auth) or 429 (rate limit) already written.
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch {
      return sendApiError(res, 400, WEBHOOK_TEST_FAILED);
    }
  }
  const webhookId = body?.webhook_id;
  if (typeof webhookId !== 'string' || !webhookId.trim()) {
    return sendApiError(res, 400, WEBHOOK_TEST_FAILED);
  }

  const client = createSupabaseServiceClient();
  if (!client) {
    return sendApiError(res, 500, WEBHOOK_TEST_FAILED);
  }

  const result = await sendDeveloperWebhookTestEvent(client, {
    webhookId: webhookId.trim(),
    organizationId: context.organization_id,
    appId: context.app_id,
  });

  if (!result.ok) {
    // Generic failure — never leak whether the webhook exists or why it failed.
    return sendApiError(res, 502, WEBHOOK_TEST_FAILED);
  }

  return sendApiSuccess(res, {
    message: 'Webhook test sent',
    status: result.status ?? 200,
  });
}
