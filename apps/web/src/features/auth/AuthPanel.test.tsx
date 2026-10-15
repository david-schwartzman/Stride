import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/login" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { AuthPanel } from "./AuthPanel";

describe("AuthPanel", () => {
  it("welcomes back on /login", () => {
    nav.pathname = "/login";
    render(<AuthPanel />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(
      screen.getByText("Your cart, wishlist and orders are waiting."),
    ).toBeInTheDocument();
  });

  it("invites to join on /signup", () => {
    nav.pathname = "/signup";
    render(<AuthPanel />);

    expect(screen.getByText("Join Stride")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Save a wishlist, check out faster and see every order in one place.",
      ),
    ).toBeInTheDocument();
  });

  it("is hidden below bp-md", () => {
    render(<AuthPanel />);

    expect(screen.getByRole("complementary")).toHaveClass("hidden", "md:flex");
  });
});
