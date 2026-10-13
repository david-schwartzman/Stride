// covers AC9 (T10, T11)
import { describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth/current", () => ({
  getCurrentSession: async () => session.current,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { RedirectIfSignedIn } from "./RedirectIfSignedIn";

describe("RedirectIfSignedIn", () => {
  it("redirects a signed-in user to /", async () => {
    session.current = { session: { id: "s" }, user: { id: "u" } };

    await expect(RedirectIfSignedIn()).rejects.toThrow("REDIRECT:/");
  });

  it("renders nothing for a guest", async () => {
    session.current = null;

    expect(await RedirectIfSignedIn()).toBeNull();
  });
});
