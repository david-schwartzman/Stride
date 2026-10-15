// covers AC9 (signup-login T10, T11); auth-api-migration AC10 (T6)
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() =>
  vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(),
);
vi.mock("@/lib/api-client", () => ({ apiFetch }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { RedirectIfSignedIn } from "./RedirectIfSignedIn";

describe("RedirectIfSignedIn", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("asks the API for the session and redirects a signed-in user to /", async () => {
    apiFetch.mockResolvedValue(
      Response.json({ id: "u", email: "ada@x.com", name: "Ada" }),
    );

    await expect(RedirectIfSignedIn()).rejects.toThrow("REDIRECT:/");
    expect(apiFetch).toHaveBeenCalledWith(
      "/auth/me",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("renders nothing for a guest (401)", async () => {
    apiFetch.mockResolvedValue(new Response(null, { status: 401 }));

    expect(await RedirectIfSignedIn()).toBeNull();
  });
});
