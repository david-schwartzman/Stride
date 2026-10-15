// covers AC9, AC13 (auth-api-migration T6/T20)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitAuth } from "./submit-auth";

const PASSWORD = "correct horse battery";
const fetchMock = vi.fn<typeof fetch>();

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function respond(status: number, body: string) {
  fetchMock.mockResolvedValue(new Response(body, { status }));
}

const login = () => form({ email: "ada@x.com", password: PASSWORD });

describe("submitAuth", () => {
  const onSignedIn = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onSignedIn.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onSignedIn with redirectTo on 200 and keeps the values meanwhile", async () => {
    respond(200, JSON.stringify({ redirectTo: "/" }));

    const state = await submitAuth("login", onSignedIn)({}, login());

    expect(onSignedIn).toHaveBeenCalledWith("/");
    expect(state).toEqual({ values: { email: "ada@x.com" } });
  });

  it.each([400, 401, 409, 429])(
    "maps a %i error body into the form state, without the password",
    async (status) => {
      respond(
        status,
        JSON.stringify({
          fieldErrors: { password: "That password isn't right. Try again." },
          formError: "Too many attempts, try again in 1 minute.",
        }),
      );

      const state = await submitAuth("login", onSignedIn)({}, login());

      expect(state).toEqual({
        fieldErrors: { password: "That password isn't right. Try again." },
        formError: "Too many attempts, try again in 1 minute.",
        values: { email: "ada@x.com" },
      });
      expect(JSON.stringify(state)).not.toContain(PASSWORD);
      expect(onSignedIn).not.toHaveBeenCalled();
    },
  );

  it("keeps the name too on sign-up", async () => {
    respond(409, JSON.stringify({ fieldErrors: { email: "taken" } }));

    const state = await submitAuth("signup", onSignedIn)(
      {},
      form({ name: "Ada", email: "ada@x.com", password: PASSWORD }),
    );

    expect(state.values).toEqual({ name: "Ada", email: "ada@x.com" });
  });

  it.each([
    ["a 500", 500, JSON.stringify({ message: "Internal server error" })],
    ["a 200 without redirectTo", 200, JSON.stringify({})],
    [
      "an off-site redirectTo",
      200,
      JSON.stringify({ redirectTo: "https://evil.example" }),
    ],
    [
      "a protocol-relative redirectTo",
      200,
      JSON.stringify({ redirectTo: "//evil.example" }),
    ],
    [
      "a backslash redirectTo (security review T30 #2)",
      200,
      JSON.stringify({ redirectTo: "/\\evil.example" }),
    ],
    ["a body that isn't JSON", 400, "<html>"],
  ])("throws on %s, as the Server Action did", async (_label, status, body) => {
    respond(status, body);

    await expect(
      submitAuth("login", onSignedIn)({}, login()),
    ).rejects.toThrow();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
