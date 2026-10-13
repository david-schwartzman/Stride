// covers AC8 (api-foundation T30)
import { ForbiddenException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OriginCheckMiddleware } from "./origin-check.middleware";

function run(method: string, headers: Record<string, string>) {
  const req = { method, headers } as unknown as Request;
  const next = vi.fn() as unknown as NextFunction;
  let error: unknown;
  try {
    new OriginCheckMiddleware().use(req, {} as Response, next);
  } catch (e) {
    error = e;
  }
  return { next, error };
}

const HOST = "shop.example";

describe("OriginCheckMiddleware", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s passes with a matching https origin",
    (method) => {
      const { next, error } = run(method, {
        origin: `https://${HOST}`,
        "x-stride-forwarded-host": HOST,
      });
      expect(error).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
    },
  );

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s is 403 with a foreign or missing origin, and the handler never runs",
    (method) => {
      const cases: Record<string, string>[] = [
        { origin: "https://evil.example", "x-stride-forwarded-host": HOST },
        { "x-stride-forwarded-host": HOST },
      ];
      for (const headers of cases) {
        const { next, error } = run(method, headers);
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(next).not.toHaveBeenCalled();
      }
    },
  );

  it("is 403 when the forwarded host is missing", () => {
    const { next, error } = run("POST", { origin: `https://${HOST}` });
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts http:// only outside production", () => {
    const headers = {
      origin: `http://${HOST}`,
      "x-stride-forwarded-host": HOST,
    };
    vi.stubEnv("NODE_ENV", "development");
    expect(run("POST", headers).error).toBeUndefined();
    vi.stubEnv("NODE_ENV", "production");
    expect(run("POST", headers).error).toBeInstanceOf(ForbiddenException);
  });

  it.each(["GET", "HEAD"])("%s passes without an origin", (method) => {
    const { next, error } = run(method, {});
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });
});
