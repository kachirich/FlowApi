/**
 * User-scoped localhost whitelist.
 *
 * SSRF protection blocks all internal/loopback hostnames by default. This module
 * narrowly relaxes that block for an allow-listed (user email, host:port) pair —
 * intended for self-hosted integrations co-located with the API gateway
 * (e.g. OpenWA / WAHA on port 8080, n8n on port 5678).
 *
 * Configure via environment variables (comma-separated, case-insensitive):
 *   LOCALHOST_WHITELIST_EMAILS=support.flowapi@gmail.com
 *   LOCALHOST_WHITELIST_HOSTS=localhost:5678,localhost:8080
 *
 * Both lists must be non-empty AND the candidate URL/email must appear in both
 * for the bypass to apply. Anything else falls through to the standard SSRF
 * checks and is blocked.
 */

const parseList = (raw) =>
  new Set(
    (raw || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

const ALLOWED_EMAILS = parseList(process.env.LOCALHOST_WHITELIST_EMAILS);
const ALLOWED_HOSTS = parseList(process.env.LOCALHOST_WHITELIST_HOSTS);

export function getHostWithPort(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.port ? `${host}:${u.port}` : host;
  } catch {
    return null;
  }
}

export function isWhitelistedFor(url, userEmail) {
  if (!userEmail) return false;
  if (ALLOWED_EMAILS.size === 0 || ALLOWED_HOSTS.size === 0) return false;

  const email = String(userEmail).trim().toLowerCase();
  if (!ALLOWED_EMAILS.has(email)) return false;

  const hostPort = getHostWithPort(url);
  if (!hostPort) return false;
  return ALLOWED_HOSTS.has(hostPort);
}
