// covers AC14 (api-foundation T36)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseIncoming = {
  host: "shop.example",
  cookie: "__Host-stride_session=abc",
  "x-real-ip": "203.0.113.7",
  "x-stride-proxy-secret": "spoofed",
};
let incoming: Record<string, string> = baseIncoming;

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(incoming),
}));

const { apiFetch, API_FETCH_TIMEOUT_MS } = await import("./api-client");

describe("apiFetch", () => {
  const fetchMock = vi.fn(async () => new Response("{}"));

  function sent(): { url: string; init: RequestInit; headers: Headers } {
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    return { url, init, headers: new Headers(init.headers) };
  }

  beforeEach(() => {
    incoming = baseIncoming;
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("WEB_PROXY_SECRET", "proxy-secret");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockClear();
  });

  it("calls API_URL with the trusted headers and the incoming cookie", async () => {
    await apiFetch("/auth/me", { headers: { accept: "application/json" } });

    const { url, headers } = sent();
    expect(url).toBe("http://api.test/auth/me");
    expect(headers.get("cookie")).toBe("__Host-stride_session=abc");
    expect(headers.get("x-stride-proxy-secret")).toBe("proxy-secret");
    expect(headers.get("x-stride-client-ip")).toBe("203.0.113.7");
    expect(headers.get("x-stride-forwarded-host")).toBe("shop.example");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("drops caller-supplied x-stride-* headers", async () => {
    await apiFetch("/auth/me", {
      headers: {
        "x-stride-proxy-secret": "caller-secret",
        "x-stride-client-ip": "198.51.100.1",
        "x-stride-forwarded-host": "evil.example",
        "x-stride-made-up": "1",
      },
    });

    const { headers } = sent();
    expect(headers.get("x-stride-proxy-secret")).toBe("proxy-secret");
    expect(headers.get("x-stride-client-ip")).toBe("203.0.113.7");
    expect(headers.get("x-stride-forwarded-host")).toBe("shop.example");
    expect(headers.has("x-stride-made-up")).toBe(false);
  });

  it("drops a caller x-stride-client-ip even when the request has no IP", async () => {
    incoming = { host: "shop.example" };
    await apiFetch("/health", {
      headers: { "x-stride-client-ip": "198.51.100.1" },
    });

    expect(sent().headers.has("x-stride-client-ip")).toBe(false);
  });

  it("passes the incoming request's own Origin through", async () => {
    incoming = { ...baseIncoming, origin: "https://shop.example" };
    await apiFetch("/auth/logout", {
      method: "POST",
      headers: { origin: "https://caller.example" },
    });

    expect(sent().headers.get("origin")).toBe("https://shop.example");
  });

  it("sends no Origin when the incoming request has none", async () => {
    await apiFetch("/auth/logout", {
      method: "POST",
      headers: { origin: "https://caller.example" },
    });

    expect(sent().headers.has("origin")).toBe(false);
  });

  it("times out after 10 seconds when the caller passes no signal", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await apiFetch("/health");

    expect(API_FETCH_TIMEOUT_MS).toBe(10_000);
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(sent().init.signal).toBe(timeout.mock.results[0]?.value);
  });

  it("keeps the caller's signal", async () => {
    const controller = new AbortController();
    await apiFetch("/health", { signal: controller.signal });

    expect(sent().init.signal).toBe(controller.signal);
  });

  it("sends the protection bypass on Preview when the secret is set", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("API_PROTECTION_BYPASS_SECRET", "bypass-secret");
    await apiFetch("/health");

    expect(sent().headers.get("x-vercel-protection-bypass")).toBe(
      "bypass-secret",
    );
  });

  it("sends no protection bypass outside Preview or without the secret", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("API_PROTECTION_BYPASS_SECRET", "bypass-secret");
    await apiFetch("/health");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("API_PROTECTION_BYPASS_SECRET", "");
    await apiFetch("/health");

    for (const [, init] of fetchMock.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(new Headers(init.headers).has("x-vercel-protection-bypass")).toBe(
        false,
      );
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses paths that could move the request to another host", async () => {
    for (const path of ["@evil.example/x", "//evil.example/x", "health"]) {
      await expect(apiFetch(path)).rejects.toThrow("single /");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to call the API in production without WEB_PROXY_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_PROXY_SECRET", "");
    await expect(apiFetch("/health")).rejects.toThrow("WEB_PROXY_SECRET");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
