// covers AC4, AC11 (api-foundation T21)
import { expect, test } from "@playwright/test";
import { healthResponseSchema } from "@stride/shared";

test("GET /api/health on the web origin returns the API's health body", async ({
  request,
}) => {
  const res = await request.get("/api/health");

  expect(res.status()).toBe(200);
  expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
  expect(healthResponseSchema.parse(await res.json())).toEqual({
    status: "ok",
    db: "ok",
  });
});
