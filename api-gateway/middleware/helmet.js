import helmet from "helmet";

/**
 * Helmet middleware — sets a comprehensive set of HTTP security headers.
 *
 * The defaults already cover:
 *   • Content-Security-Policy
 *   • Cross-Origin-Embedder-Policy
 *   • Cross-Origin-Opener-Policy
 *   • Cross-Origin-Resource-Policy
 *   • Strict-Transport-Security
 *   • X-Content-Type-Options
 *   • X-DNS-Prefetch-Control
 *   • X-Download-Options
 *   • X-Frame-Options
 *   • X-Permitted-Cross-Domain-Policies
 *   • X-XSS-Protection (set to 0, per modern best practice)
 *
 * Override individual policies here if your downstream services
 * require looser constraints.
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 63_072_000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

export default helmetMiddleware;
