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
        hostname.endsWith(".local");

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
