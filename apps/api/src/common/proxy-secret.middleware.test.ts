// covers AC13 (api-foundation T36)
import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProxySecretMiddleware } from "./proxy-secret.middleware";

const SECRET = "s3cret-value-for-tests";

function run(path: string, sent?: string) {
  const req = {
    originalUrl: path,
    headers: sent === undefined ? {} : { "x-stride-proxy-secret": sent },
  } as unknown as Request;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    end(body?: unknown) {
      this.body = body;
      this.ended = true;
      return this;
    },
  };
  const next = vi.fn() as unknown as NextFunction;
  new ProxySecretMiddleware().use(req, res as unknown as Response, next);
  return { res, next };
}

function expectRejected({ res, next }: ReturnType<typeof run>) {
  expect(next).not.toHaveBeenCalled();
  expect(res.statusCode).toBe(401);
  expect(res.ended).toBe(true);
  expect(res.body).toBeUndefined();
}

describe("ProxySecretMiddleware", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("lets a request with the right secret through", () => {
    vi.stubEnv("WEB_PROXY_SECRET", SECRET);
    const { res, next } = run("/health", SECRET);
    expect(next).toHaveBeenCalledOnce();
    expect(res.ended).toBe(false);
  });

  it("rejects a wrong secret of the same length", () => {
    vi.stubEnv("WEB_PROXY_SECRET", SECRET);
    expectRejected(run("/health", SECRET.replace(/.$/, "X")));
  });

  it("rejects a secret of a different length", () => {
    vi.stubEnv("WEB_PROXY_SECRET", SECRET);
    expectRejected(run("/health", `${SECRET}-longer`));
    expectRejected(run("/health", "short"));
  });

  it("rejects a missing secret", () => {
    vi.stubEnv("WEB_PROXY_SECRET", SECRET);
    expectRejected(run("/health"));
  });

  it("rejects everything when WEB_PROXY_SECRET is unset or empty", () => {
    vi.stubEnv("WEB_PROXY_SECRET", undefined);
    expectRejected(run("/health", ""));
    expectRejected(run("/health", "anything"));
    vi.stubEnv("WEB_PROXY_SECRET", "");
    expectRejected(run("/health", ""));
  });

  it("exempts /cron/* only", () => {
    vi.stubEnv("WEB_PROXY_SECRET", SECRET);
    expect(run("/cron/cleanup").next).toHaveBeenCalledOnce();
    expect(run("/cron/cleanup?x=1").next).toHaveBeenCalledOnce();
    expectRejected(run("/cronjob"));
    expectRejected(run("/health?next=/cron/x"));
  });
});
