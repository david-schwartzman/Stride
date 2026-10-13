// covers AC1, AC4, AC7, AC8, AC11 (T10, T13); auth-api-migration AC9 (T6)
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

import { SignupForm } from "./SignupForm";

const field = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;
const submit = () =>
  screen.getByRole("button", { name: /create account|creating account/i });

function fill(values: Partial<Record<"Name" | "Email" | "Password", string>>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(field(label), { target: { value } });
  }
}

const VALID = {
  Name: "Ada Lovelace",
  Email: "ada@x.com",
  Password: "correct horse battery",
};

describe("SignupForm", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    router.replace.mockReset();
    router.refresh.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders labelled Name, Email and Password fields with autocomplete and the password hint", () => {
    render(<SignupForm />);

    expect(field("Name")).toHaveAttribute("autocomplete", "name");
    expect(field("Email")).toHaveAttribute("type", "email");
    expect(field("Email")).toHaveAttribute("autocomplete", "email");
    expect(field("Password")).toHaveAttribute("type", "password");
    expect(field("Password")).toHaveAttribute("autocomplete", "new-password");
    expect(field("Password")).toHaveAccessibleDescription(
      "At least 12 characters.",
    );
    expect(submit()).toHaveAttribute("type", "submit");
  });

  it("validates a field on blur and wires the error to the input", () => {
    render(<SignupForm />);

    fill({ Email: "nope" });
    fireEvent.blur(field("Email"));

    expect(field("Email")).toHaveAttribute("aria-invalid", "true");
    expect(field("Email")).toHaveAccessibleDescription(
      "Enter a valid email address.",
    );
  });

  it("doesn't validate while typing, and clears the error once the field is fixed", () => {
    render(<SignupForm />);

    fill({ Password: "short" });
    expect(field("Password")).not.toHaveAttribute("aria-invalid");

    fireEvent.blur(field("Password"));
    expect(field("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters.",
    );

    fill({ Password: VALID.Password });
    fireEvent.blur(field("Password"));
    expect(field("Password")).not.toHaveAttribute("aria-invalid");
    expect(field("Password")).toHaveAccessibleDescription(
      "At least 12 characters.",
    );
  });

  it("blocks an invalid submit on the client and shows every field's error", () => {
    render(<SignupForm />);

    fireEvent.click(submit());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(field("Name")).toHaveAccessibleDescription("Enter your name.");
    expect(field("Email")).toHaveAccessibleDescription(
      "Enter a valid email address.",
    );
    expect(field("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters.",
    );
  });

  it("POSTs the fields as JSON to /api/auth/signup, then navigates to redirectTo and refreshes", async () => {
    respond(200, { redirectTo: "/" });
    render(<SignupForm />);
    fill(VALID);

    await act(async () => fireEvent.click(submit()));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Ada Lovelace",
      email: "ada@x.com",
      password: VALID.Password,
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the existing-email error on the Email field with a Log in link, keeping name and email", async () => {
    respond(409, { fieldErrors: { email: MESSAGES.emailTaken } });
    render(<SignupForm />);
    fill(VALID);

    await act(async () => fireEvent.click(submit()));

    await waitFor(() =>
      expect(field("Email")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(field("Email")).toHaveAccessibleDescription(MESSAGES.emailTaken);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(field("Name").value).toBe("Ada Lovelace");
    expect(field("Email").value).toBe("ada@x.com");
    expect(field("Password").value).toBe("");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a form-level error from the server", async () => {
    respond(429, { formError: MESSAGES.signupLimit });
    render(<SignupForm />);
    fill(VALID);

    await act(async () => fireEvent.click(submit()));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MESSAGES.signupLimit,
    );
  });

  it("shows a pending state and blocks double submit", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<SignupForm />);
    fill(VALID);

    await act(async () => fireEvent.click(submit()));

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveTextContent("Creating account…");
    fireEvent.click(submit());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
