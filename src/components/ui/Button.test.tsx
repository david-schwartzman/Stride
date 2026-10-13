// covers AC9, T9, T14
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders a type=button by default so it never submits a form by accident", () => {
    render(<Button>Shop now</Button>);
    expect(screen.getByRole("button", { name: "Shop now" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("passes type and other button attributes through", () => {
    render(
      <Button type="submit" disabled name="go">
        Place order
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Place order" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("name", "go");
    expect(button).toBeDisabled();
  });

  it("uses the volt accent only for the accent variant", () => {
    render(
      <>
        <Button variant="accent">Add to bag</Button>
        <Button>Checkout</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Add to bag" })).toHaveClass(
      "bg-volt",
      "text-on-volt",
    );
    expect(screen.getByRole("button", { name: "Checkout" })).not.toHaveClass(
      "bg-volt",
    );
  });

  it("is a pill with a focus-visible ring", () => {
    render(<Button>Shop</Button>);
    expect(screen.getByRole("button")).toHaveClass(
      "rounded-pill",
      "focus-visible:shadow-focus",
    );
  });

  it("is 48px at md and keeps a 44px touch target at sm", () => {
    render(
      <>
        <Button>Medium</Button>
        <Button size="sm">Small</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Medium" })).toHaveClass("h-12");
    // 36px visual + 4px pseudo-element above and below = 44px.
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass(
      "h-9",
      "before:-inset-y-1",
    );
  });

  it("adds a decorative trailing arrow only when asked", () => {
    const { container, rerender } = render(<Button>Shop</Button>);
    expect(container.querySelector("svg")).toBeNull();

    rerender(<Button arrow>Shop</Button>);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("button", { name: "Shop" })).toBeInTheDocument();
  });

  it("stretches to full width when fullWidth is set", () => {
    render(<Button fullWidth>Checkout</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});
