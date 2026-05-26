export function validateWebhookUrl(url) {
  try {
    const parsedUrl = new URL(url);

    const hostname = parsedUrl.hostname.toLowerCase();

    const isInternal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local');

    if (isInternal) {
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
