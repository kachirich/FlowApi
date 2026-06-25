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

  it("accepts a destinationId (test-by-id) without a destinationUrl", () => {
    const parsed = egressTestBodySchema.parse({
      destinationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      payload: { contact_id: "abc123" },
    });

    expect(parsed.destinationId).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(parsed.destinationUrl).toBeUndefined();
  });

  it("rejects a request providing both destinationUrl and destinationId", () => {
    expect(() =>
      egressTestBodySchema.parse({
        destinationUrl: "https://example.com/webhook",
        destinationId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        payload: { contact_id: "abc123" },
      })
    ).toThrow();
  });

  it("rejects a request providing neither destinationUrl nor destinationId", () => {
    expect(() =>
      egressTestBodySchema.parse({
        payload: { contact_id: "abc123" },
      })
    ).toThrow();
  });

  it("rejects a non-uuid destinationId", () => {
    expect(() =>
      egressTestBodySchema.parse({
        destinationId: "not-a-uuid",
        payload: { contact_id: "abc123" },
      })
    ).toThrow();
  });
});
