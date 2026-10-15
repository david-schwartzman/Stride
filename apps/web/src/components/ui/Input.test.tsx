// covers AC9, T10, T14
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";

function describedText(input: HTMLElement) {
  const ids = input.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent);
}

describe("Input", () => {
  it("has a visible label tied to the input", () => {
    render(<Input label="Email" type="email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(screen.getByText("Email").tagName).toBe("LABEL");
  });

  it("links the hint via aria-describedby and is not invalid", () => {
    render(<Input label="Password" hint="At least 8 characters" />);
    const input = screen.getByLabelText("Password");
    expect(describedText(input)).toEqual(["At least 8 characters"]);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error instead of the hint, linked and marked aria-invalid", () => {
    render(
      <Input
        label="Email"
        hint="We'll send your receipt here"
        error="Enter a valid email address"
      />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(describedText(input)).toEqual(["Enter a valid email address"]);
    expect(screen.queryByText("We'll send your receipt here")).toBeNull();
    expect(input).toHaveClass("border-sale");
  });

  it("has no aria-describedby when there is neither hint nor error", () => {
    render(<Input label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("keeps a caller-provided aria-describedby alongside its message", () => {
    render(
      <>
        <p id="extra">Extra help</p>
        <Input
          label="Postcode"
          error="Enter a valid postcode"
          aria-describedby="extra"
        />
      </>,
    );
    expect(describedText(screen.getByLabelText("Postcode"))).toEqual([
      "Enter a valid postcode",
      "Extra help",
    ]);
  });

  it("uses a given id and passes other props to the input", () => {
    render(
      <Input
        label="Email"
        id="signup-email"
        name="email"
        autoComplete="email"
      />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "signup-email");
    expect(input).toHaveAttribute("name", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
  });

  it("is 48px tall with a focus-visible ring", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveClass(
      "h-12",
      "focus-visible:shadow-focus",
    );
  });
});
