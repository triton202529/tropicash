import { createSupabaseServiceClient, requireAdminFromBearer } from "../../../lib/supabaseAdminApi";
import { performComplianceAccountAction } from "../../../lib/complianceAccountActions";
import { resolveComplianceScreening } from "../../../lib/complianceScreening";
import { updateAmlCaseStatus, createAmlCase, addAmlCaseNote } from "../../../lib/complianceAmlCases";
import { createComplianceIncident, updateComplianceIncident, addComplianceIncidentNote } from "../../../lib/complianceIncidents";

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdminFromBearer(req.headers.authorization);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: "Invalid JSON body" });

  const action = typeof body.action === "string" ? body.action.trim() : "";
  const admin = createSupabaseServiceClient();
  if (!admin) return res.status(500).json({ error: "Server configuration error" });
  const userId = auth.user.id;

  switch (action) {
    case "account_action": {
      const result = await performComplianceAccountAction({
        userId: body.user_id,
        actionType: body.action_type,
        reason: body.reason,
        adminUserId: userId,
        riskLevel: body.risk_level,
        notes: body.notes,
        amlCaseId: body.aml_case_id,
        metadata: body.metadata,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, ...result });
    }
    case "resolve_screening": {
      const result = await resolveComplianceScreening({
        screeningId: body.screening_id,
        status: body.status,
        adminUserId: userId,
        overrideReason: body.override_reason,
        notes: body.notes,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, screening: result.screening });
    }
    case "create_aml_case": {
      const result = await createAmlCase({
        userId: body.user_id,
        caseType: body.case_type,
        title: body.title,
        summary: body.summary,
        suspicionSummary: body.suspicion_summary,
        priority: body.priority,
        recommendedAccountAction: body.recommended_account_action,
        createdBy: userId,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, case: result.case });
    }
    case "update_aml_case": {
      const result = await updateAmlCaseStatus({
        caseId: body.case_id,
        status: body.status,
        adminUserId: userId,
        sarFilingReference: body.sar_filing_reference,
        assignedTo: body.assigned_to,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, case: result.case });
    }
    case "aml_case_note": {
      const result = await addAmlCaseNote({
        caseId: body.case_id,
        note: body.note,
        authorUserId: userId,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, note: result.note });
    }
    case "create_incident": {
      const result = await createComplianceIncident({
        incidentType: body.incident_type,
        title: body.title,
        description: body.description,
        severity: body.severity,
        classification: body.classification,
        affectedUserId: body.affected_user_id,
        createdBy: userId,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, incident: result.incident });
    }
    case "update_incident": {
      const result = await updateComplianceIncident({
        incidentId: body.incident_id,
        status: body.status,
        adminUserId: userId,
        resolutionSummary: body.resolution_summary,
        postIncidentReview: body.post_incident_review,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, incident: result.incident });
    }
    case "incident_note": {
      const result = await addComplianceIncidentNote({
        incidentId: body.incident_id,
        note: body.note,
        authorUserId: userId,
        supabaseClient: admin,
      });
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(200).json({ success: true, note: result.note });
    }
    default:
      return res.status(400).json({ error: "unknown_action" });
  }
}
