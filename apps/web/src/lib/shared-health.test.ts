// covers AC7 (api-foundation T29)
import { healthResponseSchema, type HealthResponse } from "@stride/shared";
import { describe, expect, it } from "vitest";

describe("@stride/shared in apps/web", () => {
  it("resolves healthResponseSchema from the workspace package", () => {
    const body: HealthResponse = { status: "ok", db: "ok" };
    expect(healthResponseSchema.parse(body)).toEqual(body);
    expect(healthResponseSchema.safeParse({ status: "ok" }).success).toBe(
      false,
    );
  });
});
