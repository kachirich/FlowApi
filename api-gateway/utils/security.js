import { isWhitelistedFor } from "./destinationWhitelist.js";

export function validateWebhookUrl(url, { userEmail } = {}) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { isValid: false, error: "Invalid URL protocol" };
    }

    // Narrow bypass: an allow-listed user delivering to an allow-listed
    // host:port (configured via LOCALHOST_WHITELIST_* env vars). Used for
    // self-hosted integrations co-located with the gateway.
    if (isWhitelistedFor(url, userEmail)) {
      return { isValid: true };
    }

    // SSRF Protection: Blacklist internal/private IPs
    const isInternal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      isMaliciousPrivateIP(hostname) ||
      hostname.endsWith('.local');

    if (isInternal) {
      return { isValid: false, error: "Invalid or prohibited target URL" };
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, error: "Invalid URL format" };
  }
}

/**
 * Validate private IP range 172.16.x.x - 172.31.x.x
 * RFC 1918 Class B private addressing
 */
function isMaliciousPrivateIP(hostname) {
  // Match 172.16.x.x through 172.31.x.x
  const match = hostname.match(/^172\.(\d+)\..+/);
  if (!match) return false;

  const secondOctet = parseInt(match[1], 10);
  return secondOctet >= 16 && secondOctet <= 31;
}
