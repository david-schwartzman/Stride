// covers AC2, AC5, AC7, AC8, AC14 (T11, T13); auth-api-migration AC9 (T6)
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MESSAGES } from "@stride/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

import { LoginForm } from "./LoginForm";

const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: /log in|logging in/i });

function fillValid() {
  fireEvent.change(field("Email"), { target: { value: "ada@x.com" } });
  fireEvent.change(field("Password"), {
    target: { value: "correct horse battery" },
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    router.replace.mockReset();
    router.refresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders labelled Email and Password fields with autocomplete", () => {
    render(<LoginForm />);

    expect(field("Email")).toHaveAttribute("autocomplete", "email");
    expect(field("Password")).toHaveAttribute("type", "password");
    expect(field("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(submit()).toHaveAttribute("type", "submit");
  });

  it("validates on blur", () => {
    render(<LoginForm />);

    fireEvent.change(field("Email"), { target: { value: "nope" } });
    fireEvent.blur(field("Email"));

    expect(field("Email")).toHaveAttribute("aria-invalid", "true");
    expect(field("Email")).toHaveAccessibleDescription(
      "Enter a valid email address.",
    );
  });

  it("blocks an invalid submit on the client", () => {
    render(<LoginForm />);

    fireEvent.click(submit());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(field("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters.",
    );
  });

  it("POSTs the fields as JSON to /api/auth/login, then navigates to redirectTo and refreshes", async () => {
    respond(200, { redirectTo: "/" });
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "ada@x.com",
      password: "correct horse battery",
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the API's field errors inline", async () => {
    respond(400, {
      fieldErrors: { email: "Enter a valid email address." },
    });
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    await waitFor(() =>
      expect(field("Email")).toHaveAccessibleDescription(
        "Enter a valid email address.",
      ),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a wrong password inline on the Password field and keeps the email", async () => {
    respond(401, { fieldErrors: { password: MESSAGES.wrongPassword } });
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    await waitFor(() =>
      expect(field("Password")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(field("Password")).toHaveAccessibleDescription(
      MESSAGES.wrongPassword,
    );
    expect(field("Email").value).toBe("ada@x.com");
    expect(field("Password").value).toBe("");
  });

  it("shows too many attempts as a form-level alert", async () => {
    respond(429, { formError: MESSAGES.tooManyAttempts(4) });
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts, try again in 4 minutes.",
    );
  });

  it("shows a pending state and blocks double submit", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveTextContent("Logging in…");
    fireEvent.click(submit());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
