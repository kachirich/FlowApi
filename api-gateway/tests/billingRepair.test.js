import { describe, expect, it } from "vitest";
import { retryConfig } from "../utils/retryConfig.js";
import { tierFromPlan } from "../utils/tierFromPlan.js";

describe("retryConfig", () => {
  it("preserves the 100-attempt exponential SLA for plus", () => {
    expect(retryConfig("plus")).toEqual({
      attempts: 100,
      backoff: { type: "exponential", delay: 5000 },
    });
  });

  it("gives pro 5 exponential attempts", () => {
    expect(retryConfig("pro")).toEqual({
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
    });
  });

  it("gives free/basic/unknown a single attempt with no retry", () => {
    for (const plan of ["free", "basic", undefined, "sandbox"]) {
      expect(retryConfig(plan)).toEqual({ attempts: 1, backoff: undefined });
    }
  });
});

describe("tierFromPlan", () => {
  it("maps paid plans to their billing tier", () => {
    expect(tierFromPlan("plus")).toBe("enterprise");
    expect(tierFromPlan("pro")).toBe("growth");
  });

  it("maps everything else to sandbox", () => {
    for (const plan of ["free", "basic", undefined, "nonsense"]) {
      expect(tierFromPlan(plan)).toBe("sandbox");
    }
  });
});
