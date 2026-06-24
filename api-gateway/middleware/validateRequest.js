import { z } from "zod";

export const webhookDestinationSchema = z.string().superRefine((val, ctx) => {
  try {
    new URL(val);
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid URL format" });
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
