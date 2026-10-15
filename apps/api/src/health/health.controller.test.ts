// covers AC3, AC7 (api-foundation T29)
import { HttpException, HttpStatus } from "@nestjs/common";
import { healthResponseSchema } from "@stride/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { HealthController } from "./health.controller";

const SECRET_URL = "postgresql://stride:hunter2@db.internal:5432/stride";

function controller(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(queryRaw) };
  return {
    prisma,
    health: new HealthController(prisma as unknown as PrismaService),
  };
}

async function expect503(promise: Promise<unknown>) {
  const error = await promise.then(
    () => expect.unreachable("expected a 503"),
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  expect(http.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  return http.getResponse();
}

describe("HealthController", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 200 ok when SELECT 1 succeeds", async () => {
    const { prisma, health } = controller(async () => [{ "?column?": 1 }]);
    const body = await health.check();
    expect(body).toEqual({ status: "ok", db: "ok" });
    expect(healthResponseSchema.parse(body)).toEqual(body);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it("answers 503 down when Prisma throws", async () => {
    const { health } = controller(async () => {
      throw new Error("db unreachable");
    });
    const body = await expect503(health.check());
    expect(body).toEqual({ status: "error", db: "down" });
    expect(healthResponseSchema.parse(body)).toEqual(body);
  });

  it("answers 503 down when the query times out", async () => {
    vi.useFakeTimers();
    const { health } = controller(() => new Promise(() => {}));
    const pending = health.check();
    const assertion = expect503(pending);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await assertion).toEqual({ status: "error", db: "down" });
  });

  it("never puts the error text, connection string or stack in the body", async () => {
    const leaky = new Error(`Can't reach database server at ${SECRET_URL}`);
    const { health } = controller(async () => {
      throw leaky;
    });
    const serialized = JSON.stringify(await expect503(health.check()));
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("postgresql://");
    expect(serialized).not.toContain("Can't reach");
    expect(serialized).toBe(JSON.stringify({ status: "error", db: "down" }));
  });
});
