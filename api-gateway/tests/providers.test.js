import { describe, expect, it } from "vitest";
import { getAuthHeader, PROVIDER_IDS, BROWSABLE_PROVIDER_IDS } from "../services/providers/registry.js";
import { browseDestinationSchema } from "../middleware/validateRequest.js";

describe("provider registry auth", () => {
  it("uses xc-token for NocoDB", () => {
    expect(getAuthHeader("nocodb", "TOK")).toEqual({ name: "xc-token", value: "TOK" });
  });

  it("uses Authorization: Bearer for generic, n8n, and unknown providers", () => {
    for (const p of ["generic", "n8n", undefined, "made-up"]) {
      expect(getAuthHeader(p, "TOK")).toEqual({ name: "Authorization", value: "Bearer TOK" });
    }
  });

  it("returns null when there is no token", () => {
    expect(getAuthHeader("nocodb", null)).toBeNull();
  });

  it("registers generic/nocodb/n8n; only nocodb is browsable", () => {
    expect(PROVIDER_IDS).toEqual(["generic", "nocodb", "n8n"]);
    expect(BROWSABLE_PROVIDER_IDS).toEqual(["nocodb"]);
  });
});

describe("browseDestinationSchema", () => {
  it("accepts a NocoDB browse request and defaults path to []", () => {
    const parsed = browseDestinationSchema.parse({ provider: "nocodb", api_token: "tok" });
    expect(parsed.path).toEqual([]);
  });

  it("rejects a non-browsable provider (n8n)", () => {
    expect(() => browseDestinationSchema.parse({ provider: "n8n", api_token: "tok" })).toThrow();
  });

  it("rejects a missing token", () => {
    expect(() => browseDestinationSchema.parse({ provider: "nocodb" })).toThrow();
  });
});
