// covers AC14 (api-foundation T36)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      host: "shop.example",
      cookie: "__Host-stride_session=abc",
      "x-real-ip": "203.0.113.7",
      "x-stride-proxy-secret": "spoofed",
    }),
}));

const { apiFetch } = await import("./api-client");

describe("apiFetch", () => {
  const fetchMock = vi.fn(async () => new Response("{}"));

  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("WEB_PROXY_SECRET", "proxy-secret");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockClear();
  });

  it("calls API_URL with the trusted headers and the incoming cookie", async () => {
    await apiFetch("/auth/me", { headers: { accept: "application/json" } });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://api.test/auth/me");
    const sent = new Headers(init.headers);
    expect(sent.get("cookie")).toBe("__Host-stride_session=abc");
    expect(sent.get("x-stride-proxy-secret")).toBe("proxy-secret");
    expect(sent.get("x-stride-client-ip")).toBe("203.0.113.7");
    expect(sent.get("x-stride-forwarded-host")).toBe("shop.example");
    expect(sent.get("accept")).toBe("application/json");
  });
});
