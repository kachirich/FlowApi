import { z } from "zod";

/**
 * Zod schema for webhook destination URLs with strict SSRF protection.
 * Requires https:// and strictly rejects internal/local IP blocks and domains.
 */
export const webhookDestinationSchema = z
  .string()
  .url({ message: "Invalid URL format" })
  .startsWith("https://", { message: "Secure HTTPS connections are required." })
  .superRefine((url, ctx) => {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      const isInternal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("172.16.") ||
        hostname.startsWith("172.17.") ||
        hostname.startsWith("172.18.") ||
        hostname.startsWith("172.19.") ||
        hostname.startsWith("172.20.") ||
        hostname.startsWith("172.21.") ||
        hostname.startsWith("172.22.") ||
        hostname.startsWith("172.23.") ||
        hostname.startsWith("172.24.") ||
        hostname.startsWith("172.25.") ||
        hostname.startsWith("172.26.") ||
        hostname.startsWith("172.27.") ||
        hostname.startsWith("172.28.") ||
        hostname.startsWith("172.29.") ||
        hostname.startsWith("172.30.") ||
        hostname.startsWith("172.31.") ||
        hostname.startsWith("169.254.") || // Cloud metadata SSRF
        hostname.endsWith(".local") ||
        // CGNAT 100.64.0.0/10 (AWS NAT, Tailscale)
        hostname.startsWith("100.64.") || hostname.startsWith("100.65.") ||
        hostname.startsWith("100.66.") || hostname.startsWith("100.67.") ||
        hostname.startsWith("100.68.") || hostname.startsWith("100.69.") ||
        hostname.startsWith("100.70.") || hostname.startsWith("100.71.") ||
        hostname.startsWith("100.72.") || hostname.startsWith("100.73.") ||
        hostname.startsWith("100.74.") || hostname.startsWith("100.75.") ||
        hostname.startsWith("100.76.") || hostname.startsWith("100.77.") ||
        hostname.startsWith("100.78.") || hostname.startsWith("100.79.") ||
        hostname.startsWith("100.80.") || hostname.startsWith("100.81.") ||
        hostname.startsWith("100.82.") || hostname.startsWith("100.83.") ||
        hostname.startsWith("100.84.") || hostname.startsWith("100.85.") ||
        hostname.startsWith("100.86.") || hostname.startsWith("100.87.") ||
        hostname.startsWith("100.88.") || hostname.startsWith("100.89.") ||
        hostname.startsWith("100.90.") || hostname.startsWith("100.91.") ||
        hostname.startsWith("100.92.") || hostname.startsWith("100.93.") ||
        hostname.startsWith("100.94.") || hostname.startsWith("100.95.") ||
        hostname.startsWith("100.96.") || hostname.startsWith("100.97.") ||
        hostname.startsWith("100.98.") || hostname.startsWith("100.99.") ||
        hostname.startsWith("100.100.") || hostname.startsWith("100.101.") ||
        hostname.startsWith("100.102.") || hostname.startsWith("100.103.") ||
        hostname.startsWith("100.104.") || hostname.startsWith("100.105.") ||
        hostname.startsWith("100.106.") || hostname.startsWith("100.107.") ||
        hostname.startsWith("100.108.") || hostname.startsWith("100.109.") ||
        hostname.startsWith("100.110.") || hostname.startsWith("100.111.") ||
        hostname.startsWith("100.112.") || hostname.startsWith("100.113.") ||
        hostname.startsWith("100.114.") || hostname.startsWith("100.115.") ||
        hostname.startsWith("100.116.") || hostname.startsWith("100.117.") ||
        hostname.startsWith("100.118.") || hostname.startsWith("100.119.") ||
        hostname.startsWith("100.120.") || hostname.startsWith("100.121.") ||
        hostname.startsWith("100.122.") || hostname.startsWith("100.123.") ||
        hostname.startsWith("100.124.") || hostname.startsWith("100.125.") ||
        hostname.startsWith("100.126.") || hostname.startsWith("100.127.") ||
        // IPv6 private ranges
        hostname === "::" ||        // IPv6 unspecified address
        hostname === "::1" ||       // IPv6 loopback (already caught above but explicit here)
        hostname.startsWith("fd") ||
        hostname.startsWith("fe80") ||
        hostname.startsWith("::ffff:");

      if (isInternal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Internal or restricted IP addresses are prohibited.",
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Malformed URL.",
      });
    }
  });

/**
 * Zod schema for JSON mapping keys/values.
 * Validates that it is a standard string, number, or array of strings (arrays are joined with ", ").
 * Numbers are coerced to strings. Maximum length is 255 characters for strings.
 */
export const jsonKeyMappingSchema = z
  .union([
    z.string().trim().min(1, "Cannot be empty").max(255, "Maximum length is 255 characters"),
    z.number().transform((n) => n.toString()),
    z.array(z.string()).min(1, "Cannot be empty array").transform((arr) => arr.join(", "))
  ]);

/**
 * Schema for an entire mappings object (custom headers or payload keys).
 */
export const mappingsObjectSchema = z.record(z.string(), jsonKeyMappingSchema);

const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const jsonValueSchema = z.lazy(() => z.union([
  jsonPrimitiveSchema,
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

export const egressPayloadSchema = z.record(z.string(), jsonValueSchema);

/**
 * Express middleware factory to validate the request body against a Zod schema.
 */
export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      // Replace req.body with the sanitized/parsed values
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Find the first error message to send back a clean string
        const firstIssue = err.issues[0];
        const fieldName = firstIssue.path.join(".");
        const message = fieldName ? `${fieldName}: ${firstIssue.message}` : firstIssue.message;
        
        return res.status(400).json({
          success: false,
          message: message,
          errors: err.errors,
        });
      }
      next(err);
    }
  };
};

/**
 * Pre-configured schema for the Webhook Configuration PUT route
 */
export const webhookConfigBodySchema = z.object({
  target_url: webhookDestinationSchema.optional(),
  http_method: z.enum(["GET", "POST", "PUT", "PATCH"]).optional(),
  custom_headers: mappingsObjectSchema.optional(),
}).refine(data => data.target_url !== undefined || data.http_method !== undefined || data.custom_headers !== undefined, {
  message: "At least one of target_url, http_method or custom_headers is required",
});

/**
 * Pre-configured schema for the Egress Test POST route
 */
export const egressTestBodySchema = z.object({
  destinationUrl: webhookDestinationSchema,
  payload: egressPayloadSchema,
});

/* ═══════════════════════════════════════════════════════════════════════════
   Flow management schemas
   ═══════════════════════════════════════════════════════════════════════════ */

const routingStrategySchema = z.enum(["round_robin", "broadcast"], {
  message: "routing_strategy must be 'round_robin' or 'broadcast'",
});

const flowNameSchema = z
  .string()
  .trim()
  .min(1, "Name cannot be empty")
  .max(255, "Maximum length is 255 characters");

/**
 * POST /api/flows
 */
export const createFlowSchema = z.object({
  name: flowNameSchema,
  routing_strategy: routingStrategySchema.optional(),
  destination_ids: z.array(z.string().uuid("Invalid destination id")).optional(),
});

/**
 * PUT /api/flows/:id
 */
export const updateFlowSchema = z
  .object({
    name: flowNameSchema.optional(),
    routing_strategy: routingStrategySchema.optional(),
  })
  .refine(
    (data) => data.name !== undefined || data.routing_strategy !== undefined,
    { message: "At least one of name or routing_strategy is required" }
  );

/**
 * POST /api/flows/:id/destinations
 */
export const addFlowDestinationSchema = z.object({
  destination_id: z.string().uuid("Invalid destination id"),
});

/**
 * PUT /api/keys/:id/flow  (null unassigns the flow)
 */
export const assignFlowSchema = z.object({
  flow_id: z.string().uuid("Invalid flow id").nullable(),
});

/**
 * PUT /api/keys/:id/signature-required
 */
export const signatureRequiredSchema = z.object({
  required: z.boolean({ message: "required must be a boolean" }),
});

/* ═══════════════════════════════════════════════════════════════════════════
   Per-destination lead metering / credit balance schemas
   ═══════════════════════════════════════════════════════════════════════════ */

/** PUT /api/destinations/:id/balance/settings */
export const balanceSettingsSchema = z
  .object({
    is_metered: z.boolean().optional(),
    exhausted_action: z.enum(["pause", "continue"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

/** POST /api/destinations/:id/balance/top-up-request */
export const topUpRequestSchema = z.object({
  pack: z.enum(["starter", "growth", "pro"]),
});

/** POST /api/destinations/:id/balance/admin-credit */
export const adminCreditSchema = z.object({
  amount: z.number().int().positive().max(100000),
  pack_name: z.string().optional(),
  note: z.string().max(200).optional(),
});
