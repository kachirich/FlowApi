export function validateWebhookUrl(url, isUserWhitelisted = false) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

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

    // Allow internal URLs only if user is whitelisted
    if (isInternal && !isUserWhitelisted) {
      return { isValid: false, error: "Invalid or prohibited target URL" };
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return { isValid: false, error: "Invalid URL protocol" };
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
