// covers AC14 (api-foundation T36)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trustedProxyHeaders } from "./api-proxy";

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
