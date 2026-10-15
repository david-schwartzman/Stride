// covers AC7 (api-foundation T29)
import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "./index";

describe("healthResponseSchema", () => {
  it("accepts the ok body", () => {
    expect(healthResponseSchema.parse({ status: "ok", db: "ok" })).toEqual({
      status: "ok",
      db: "ok",
    });
  });

  it("accepts the down body", () => {
    expect(healthResponseSchema.parse({ status: "error", db: "down" })).toEqual(
      { status: "error", db: "down" },
    );
  });

  it.each([
    { status: "ok", db: "down" },
    { status: "error", db: "ok" },
    { status: "ok" },
    { db: "ok" },
    { status: "degraded", db: "ok" },
    {},
    null,
    "ok",
  ])("rejects %j", (body) => {
    expect(healthResponseSchema.safeParse(body).success).toBe(false);
  });

  it("strips unknown keys such as an error message", () => {
    expect(
      healthResponseSchema.parse({
        status: "error",
        db: "down",
        error: "boom",
      }),
    ).toEqual({ status: "error", db: "down" });
  });
});
