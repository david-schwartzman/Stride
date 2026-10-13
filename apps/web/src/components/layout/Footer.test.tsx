// covers AC8, T12, T14
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "./Footer";

function column(name: string) {
  return within(screen.getByRole("navigation", { name }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("Footer", () => {
  it("is on surface-inverse with on-inverse text", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toHaveClass(
      "bg-surface-inverse",
      "text-on-inverse",
    );
  });

  it("shows the brand line and tagline", () => {
    render(<Footer />);
    expect(screen.getByText("Stride")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Less choice. Clearer guidance. Faster decisions. Running gear for your first 5K and 10K.",
      ),
    ).toBeInTheDocument();
  });

  it("has the three link columns", () => {
    render(<Footer />);
    expect(column("Shop by run")).toEqual(["Road", "Trail", "Race day"]);
    expect(column("Shop")).toEqual(["Shoes", "Apparel", "Gear"]);
    expect(column("Your account")).toEqual([
      "Sign in",
      "My orders",
      "Wishlist",
    ]);
  });

  it("links the account column to its routes", () => {
    render(<Footer />);
    const account = screen.getByRole("navigation", { name: "Your account" });
    expect(
      within(account).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(account).getByRole("link", { name: "My orders" }),
    ).toHaveAttribute("href", "/account");
    expect(
      within(account).getByRole("link", { name: "Wishlist" }),
    ).toHaveAttribute("href", "/wishlist");
  });

  it("underlines links on hover", () => {
    render(<Footer />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("hover:underline");
    }
  });

  it("shows the bottom row", () => {
    render(<Footer />);
    expect(
      screen.getByText(
        "© 2026 Stride · A Moveo Academy capstone · Prices in USD",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("$5 shipping · free on orders over $75"),
    ).toBeInTheDocument();
  });
});
