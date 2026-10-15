// covers AC8, AC13 (api-foundation T30, T36): the middleware is wired into
// AppModule for every route, the proxy-secret check first.
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

const SECRET = "wiring-test-secret";
const HOST = "shop.example";

describe("AppModule middleware wiring", () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => [{ "?column?": 1 }] })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.stubEnv("WEB_PROXY_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function call(
    path: string,
    init: { method?: string; headers?: Record<string, string> } = {},
  ) {
    return fetch(`${base}${path}`, init);
  }

  it("answers GET /health without the secret with 401 and an empty body", async () => {
    const res = await call("/health");
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("answers GET /health with the secret with 200 ok", async () => {
    const res = await call("/health", {
      headers: { "x-stride-proxy-secret": SECRET },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "ok" });
  });

  it("answers an unknown route without the secret with 401, not 404", async () => {
    const res = await call("/does-not-exist");
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("");
  });

  it("rejects a POST with the secret but a foreign Origin with 401", async () => {
    const res = await call("/health", {
      method: "POST",
      headers: {
        "x-stride-proxy-secret": SECRET,
        "x-stride-forwarded-host": HOST,
        origin: "https://evil.example",
      },
    });
    expect(res.status).toBe(401);
    // The Origin check (Nest's UnauthorizedException) answers with a JSON body.
    expect(await res.json()).toMatchObject({ statusCode: 401 });
  });

  it("runs the secret check before the Origin check", async () => {
    const res = await call("/health", {
      method: "POST",
      headers: {
        "x-stride-forwarded-host": HOST,
        origin: "https://evil.example",
      },
    });
    expect(res.status).toBe(401);
    // An empty body is the proxy-secret check's answer, not the Origin check's.
    expect(await res.text()).toBe("");
  });

  it("lets a POST with the secret and a matching Origin reach routing", async () => {
    const res = await call("/does-not-exist", {
      method: "POST",
      headers: {
        "x-stride-proxy-secret": SECRET,
        "x-stride-forwarded-host": HOST,
        origin: `https://${HOST}`,
      },
    });
    expect(res.status).toBe(404);
  });
});
