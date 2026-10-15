// covers AC14 (api-foundation T36); AC4, AC10, AC12 (T31)
// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRewrite, trustedProxyHeaders } from "./api-proxy";

describe("trustedProxyHeaders", () => {
  beforeEach(() => vi.stubEnv("WEB_PROXY_SECRET", "proxy-secret"));
  afterEach(() => vi.unstubAllEnvs());

  it("replaces every client-sent x-stride-* header", () => {
    const out = trustedProxyHeaders(
      new Headers({
        host: "shop.example",
        "x-real-ip": "203.0.113.7",
        "x-stride-proxy-secret": "spoofed",
        "x-stride-client-ip": "198.51.100.1",
        "x-stride-forwarded-host": "evil.example",
        "x-stride-anything": "spoofed",
      }),
    );
    expect(out.get("x-stride-proxy-secret")).toBe("proxy-secret");
    expect(out.get("x-stride-client-ip")).toBe("203.0.113.7");
    expect(out.get("x-stride-forwarded-host")).toBe("shop.example");
    expect(out.has("x-stride-anything")).toBe(false);
  });

  it("omits x-stride-client-ip when the client IP is unknown", () => {
    const out = trustedProxyHeaders(
      new Headers({ host: "shop.example", "x-stride-client-ip": "1.2.3.4" }),
    );
    expect(out.has("x-stride-client-ip")).toBe(false);
  });

  it("sets the forwarded host from Host and keeps the other headers", () => {
    const out = trustedProxyHeaders(
      new Headers({ host: "localhost:3000", cookie: "a=1; b=2" }),
    );
    expect(out.get("x-stride-forwarded-host")).toBe("localhost:3000");
    expect(out.get("cookie")).toBe("a=1; b=2");
  });
});

describe("apiRewrite", () => {
  function rewrite(url: string, headers: Record<string, string> = {}) {
    return apiRewrite(
      new NextRequest(url, { headers: { host: "localhost:3000", ...headers } }),
    );
  }
  const target = (res: Response) => res.headers.get("x-middleware-rewrite");
  const forwarded = (res: Response, name: string) =>
    res.headers.get(`x-middleware-request-${name}`);

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("WEB_PROXY_SECRET", "proxy-secret");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("API_PROTECTION_BYPASS_SECRET", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("strips the /api prefix", () => {
    expect(target(rewrite("http://localhost:3000/api/health"))).toBe(
      "http://api.test/health",
    );
    expect(target(rewrite("http://localhost:3000/api"))).toBe(
      "http://api.test/",
    );
  });

  it("keeps the query string", () => {
    expect(
      target(rewrite("http://localhost:3000/api/products?page=2&q=red%20shoe")),
    ).toBe("http://api.test/products?page=2&q=red%20shoe");
  });

  it("defaults to the local API outside production when API_URL is unset", () => {
    vi.stubEnv("API_URL", "");
    expect(target(rewrite("http://localhost:3000/api/health"))).toBe(
      "http://localhost:4000/health",
    );
  });

  it("passes the Cookie header through with the trusted headers", () => {
    const res = rewrite("http://localhost:3000/api/me", {
      cookie: "__Host-stride_session=abc; theme=dark",
      "x-stride-proxy-secret": "spoofed",
    });
    expect(forwarded(res, "cookie")).toBe(
      "__Host-stride_session=abc; theme=dark",
    );
    expect(forwarded(res, "x-stride-proxy-secret")).toBe("proxy-secret");
    expect(forwarded(res, "x-stride-forwarded-host")).toBe("localhost:3000");
  });

  it("adds the protection bypass only on Preview with the secret set", () => {
    vi.stubEnv("API_PROTECTION_BYPASS_SECRET", "bypass-secret");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(
      forwarded(
        rewrite("http://localhost:3000/api/health"),
        "x-vercel-protection-bypass",
      ),
    ).toBe("bypass-secret");

    vi.stubEnv("VERCEL_ENV", "production");
    expect(
      forwarded(
        rewrite("http://localhost:3000/api/health"),
        "x-vercel-protection-bypass",
      ),
    ).toBeNull();

    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("API_PROTECTION_BYPASS_SECRET", "");
    expect(
      forwarded(
        rewrite("http://localhost:3000/api/health"),
        "x-vercel-protection-bypass",
      ),
    ).toBeNull();
  });

  it.each(["API_URL", "WEB_PROXY_SECRET"])(
    "answers 503 in production when %s is missing and logs only its name",
    (name) => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv(name, "");
      const res = rewrite("http://localhost:3000/api/health");
      expect(res.status).toBe(503);
      expect(target(res)).toBeNull();
      expect(error).toHaveBeenCalledOnce();
      const logged = String(error.mock.calls[0][0]);
      expect(logged).toContain(name);
      expect(logged).not.toContain("proxy-secret");
      expect(logged).not.toContain("api.test");
    },
  );

  it("rewrites in production when both variables are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(target(rewrite("https://shop.example/api/health"))).toBe(
      "http://api.test/health",
    );
  });
});
