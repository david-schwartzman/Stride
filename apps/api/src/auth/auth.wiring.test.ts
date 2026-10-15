// covers AC1, AC13 (auth-api-migration; security review: proxy-secret check before body parsing)
// The real AppModule and setupApp pipeline over HTTP, with Prisma stubbed: the
// proxy-secret check runs before body parsing and the Origin check before any
// auth handler.
import { randomBytes } from "node:crypto";

import { HttpException } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import type { Request, Response } from "express";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AppModule } from "../app.module";
import { OriginCheckMiddleware } from "../common/origin-check.middleware";
import { PrismaService } from "../prisma/prisma.service";
import { setupApp } from "../setup-app";
import { AuthController } from "./auth.controller";

const SECRET = "wiring-test-proxy-secret";
const HOST = "shop.example";
const FOREIGN = "https://evil.example";

let app: NestExpressApplication;
let baseUrl: string;

/** Spies on a handler, keeping the route metadata Nest reads off the method. */
function spyOnHandler(method: "login" | "logout" | "signup") {
  const original = AuthController.prototype[method];
  const spy = vi.spyOn(AuthController.prototype, method);
  for (const key of Reflect.getMetadataKeys(original)) {
    Reflect.defineMetadata(key, Reflect.getMetadata(key, original), spy);
  }
  return spy;
}

const handlers = {
  login: spyOnHandler("login"),
  logout: spyOnHandler("logout"),
  signup: spyOnHandler("signup"),
};

/**
 * The status OriginCheckMiddleware itself gives a foreign Origin: 403 today
 * (it throws ForbiddenException). api-foundation's review fixes change it to
 * 401; asking the middleware keeps this test right on both sides of that merge.
 */
function originRejectionStatus(): number {
  const req = {
    method: "POST",
    headers: { origin: FOREIGN, "x-stride-forwarded-host": HOST },
  } as unknown as Request;
  let status: number | undefined;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    end: () => res,
    json: () => res,
    send: () => res,
  };
  try {
    new OriginCheckMiddleware().use(req, res as unknown as Response, () => {
      status = 200;
    });
  } catch (error) {
    status = error instanceof HttpException ? error.getStatus() : 500;
  }
  return status ?? 0;
}

function post(path: string, body: string, headers: Record<string, string>) {
  return fetch(`${baseUrl}/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    redirect: "manual",
  });
}

const proxied = (origin: string) => ({
  "x-stride-proxy-secret": SECRET,
  "x-stride-forwarded-host": HOST,
  origin,
});

beforeAll(async () => {
  vi.stubEnv("WEB_PROXY_SECRET", SECRET);
  vi.stubEnv("PASSWORD_PEPPER", randomBytes(32).toString("base64"));
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
    bodyParser: false,
  });
  setupApp(app);
  await app.listen(0, "127.0.0.1");
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterEach(() => {
  for (const spy of Object.values(handlers)) spy.mockClear();
});

describe("AppModule wiring: proxy secret first", () => {
  it.each(["login", "logout", "signup"])(
    "POST /auth/%s without the secret → 401, empty body, handler never runs",
    async (path) => {
      const res = await post(path, '{"email":"a@b.c","password":"x"}', {
        "x-stride-forwarded-host": HOST,
        origin: `https://${HOST}`,
      });

      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
      expect(handlers[path as keyof typeof handlers]).not.toHaveBeenCalled();
    },
  );

  it.each(["login", "signup", "logout"])(
    "a malformed body to /auth/%s without the secret → 401 with an empty body, not 400",
    async (path) => {
      const res = await post(path, '{"password":hunter2', {});

      expect(res.status).toBe(401);
      expect(await res.text()).toBe("");
      expect(handlers[path as keyof typeof handlers]).not.toHaveBeenCalled();
    },
  );

  it("a wrong secret is refused the same way", async () => {
    const res = await post("login", "{}", {
      ...proxied(`https://${HOST}`),
      "x-stride-proxy-secret": "wrong",
    });

    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
    expect(handlers.login).not.toHaveBeenCalled();
  });
});

describe("AppModule wiring: Origin check before the handler", () => {
  it.each(["login", "logout"])(
    "POST /auth/%s with the secret but a foreign Origin → the middleware's rejection, handler never runs",
    async (path) => {
      const expected = originRejectionStatus();
      expect([401, 403]).toContain(expected);

      const res = await post(path, "{}", proxied(FOREIGN));

      expect(res.status).toBe(expected);
      expect(handlers[path as keyof typeof handlers]).not.toHaveBeenCalled();
    },
  );
});

describe("AppModule wiring: a proxied same-origin request still gets through", () => {
  it("parses the body after the secret check (malformed → the empty form's 400)", async () => {
    const res = await post(
      "login",
      '{"password":hunter2',
      proxied(`https://${HOST}`),
    );

    const text = await res.text();
    expect(res.status, text).toBe(400);
    expect(text).not.toContain("hunter2");
    expect(JSON.parse(text)).toHaveProperty("fieldErrors");
  });

  it("reaches the logout handler (303 to /)", async () => {
    const res = await post("logout", "{}", proxied(`https://${HOST}`));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
    expect(handlers.logout).toHaveBeenCalledOnce();
  });
});
