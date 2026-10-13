// covers AC2, AC5, AC7, AC8, AC14 (T11, T13)
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MESSAGES } from "@stride/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthFormState } from "./form-state";

const loginAction = vi.hoisted(() =>
  vi.fn<(prev: AuthFormState, data: FormData) => Promise<AuthFormState>>(),
);
vi.mock("./actions", () => ({ loginAction }));

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
    loginAction.mockReset();
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

    expect(loginAction).not.toHaveBeenCalled();
    expect(field("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters.",
    );
  });

  it("shows a wrong password inline on the Password field and keeps the email", async () => {
    loginAction.mockResolvedValue({
      fieldErrors: { password: MESSAGES.wrongPassword },
      values: { email: "ada@x.com" },
    });
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
    loginAction.mockResolvedValue({
      formError: MESSAGES.tooManyAttempts(4),
      values: { email: "ada@x.com" },
    });
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts, try again in 4 minutes.",
    );
  });

  it("shows a pending state and blocks double submit", async () => {
    loginAction.mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);
    fillValid();

    await act(async () => fireEvent.click(submit()));

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveTextContent("Logging in…");
    fireEvent.click(submit());
    expect(loginAction).toHaveBeenCalledTimes(1);
  });
});
