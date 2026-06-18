import { describe, expect, it } from "vitest";
import { egressTestBodySchema, mappingsObjectSchema } from "../middleware/validateRequest.js";

describe("egressTestBodySchema", () => {
  it("accepts the Sandbox payload shape with nested custom_fields", () => {
    const parsed = egressTestBodySchema.parse({
      destinationUrl: "https://example.com/webhook",
      payload: {
        contact_id: "abc123-ghl-contact-id",
        first_name: "Enterprise",
        tags: ["new_lead", "website"],
        custom_fields: {
          company: "Acme Corporation",
          deal_value: 5000,
          lead_status: "new",
        },
      },
    });

    expect(parsed.payload.tags).toEqual(["new_lead", "website"]);
    expect(parsed.payload.custom_fields).toEqual({
      company: "Acme Corporation",
      deal_value: 5000,
      lead_status: "new",
    });
  });

  it("keeps mapping values restricted to flat strings, numbers, and string arrays", () => {
    expect(() => {
      mappingsObjectSchema.parse({
        custom_fields: {
          company: "Acme Corporation",
        },
      });
    }).toThrow();
  });
});
