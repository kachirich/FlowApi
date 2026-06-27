// Shared sample lead used by the Destination Sandbox (mapped-mode payload) and
// the Live Dashboard's "simulate lead" ping. Single source of truth so the two
// never drift.
export const GHL_STANDARD_SCHEMA = {
  contact_id: "abc123-ghl-contact-id",
  first_name: "Enterprise",
  last_name: "Test",
  email: "ceo@acmecorp.com",
  phone: "+1234567890",
  tags: ["new_lead", "website"],
  source: "FlowAPI Dashboard Test",
  companyName: "Acme Corporation",
  date_added: new Date().toISOString(),
  custom_fields: {
    company: "Acme Corporation",
    deal_value: 5000,
    lead_status: "new",
  },
  location_id: "loc_abc123",
  assigned_to: "user_xyz789",
};

/**
 * Translate an egress HTTP status into an actionable, user-facing message.
 * Used by the sandbox response panel when a delivery fails.
 */
export function egressStatusHelp(statusCode) {
  if (statusCode === 404) {
    return "Destination URL not found (404). Verify the exact endpoint — for token destinations, recreate it through the picker so the full path is stored, not just the host.";
  }
  if (statusCode === 400) {
    return "The destination rejected the payload (400). Check that your JSON keys match the destination's expected fields (e.g. NocoDB column names are case-sensitive).";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "Access denied by the destination (auth). Check the stored API token and that it has write access.";
  }
  if (statusCode >= 500) {
    return "The destination server failed to process the request (5xx). This is an issue on their end.";
  }
  return "Dispatch failed. Open the raw trace below for the destination's exact response.";
}
