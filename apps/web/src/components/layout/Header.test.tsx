// covers AC7, T11, T14
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Header } from "./Header";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

// jsdom has no matchMedia; this stub lets a test fire a bp-md change.
const media = vi.hoisted(() => ({
  listeners: new Set<(event: { matches: boolean }) => void>(),
}));

beforeEach(() => {
  navigation.pathname = "/";
  media.listeners.clear();
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    addEventListener: (_: string, fn: (event: { matches: boolean }) => void) =>
      media.listeners.add(fn),
    removeEventListener: (
      _: string,
      fn: (event: { matches: boolean }) => void,
    ) => media.listeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
});

function linkTargets(container: HTMLElement) {
  return within(container)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
}

describe("Header", () => {
  it("shows the wordmark linking home and the main nav", () => {
    render(<Header />);
    expect(screen.getByRole("link", { name: "Stride home" })).toHaveAttribute(
      "href",
      "/",
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Shoes", "Apparel", "Gear"]);
  });

  it("has a labelled, placeholder-only search field", () => {
    render(<Header />);
    const search = screen.getByRole("searchbox", { name: "Search products" });
    expect(search.closest("form")).toBeNull();
  });

  it("labels every icon control for screen readers", () => {
    render(<Header />);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Wishlist" })).toHaveAttribute(
      "href",
      "/wishlist",
    );
    expect(screen.getByRole("link", { name: "Cart, 0 items" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });

  it("hides the cart count at 0", () => {
    render(<Header />);
    expect(screen.queryByTestId("cart-count")).toBeNull();
  });

  it("shows the cart count when above 0 and says it in the label", () => {
    render(<Header cartCount={3} />);
    expect(screen.getByTestId("cart-count")).toHaveTextContent("3");
    expect(
      screen.getByRole("link", { name: "Cart, 3 items" }),
    ).toBeInTheDocument();
  });

  it("names the signed-in customer on the account icon", () => {
    render(<Header accountName="Dana" />);
    expect(
      screen.getByRole("link", { name: "Account, signed in as Dana" }),
    ).toBeInTheDocument();
  });

  it("is sticky", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toHaveClass("sticky", "top-0");
  });

  it("renders the signed-out utility row by default", () => {
    render(<Header />);
    const utility = screen.getByRole("navigation", {
      name: "Help and account",
    });
    expect(utility).toHaveClass("bg-surface-alt");
    expect(linkTargets(utility)).toEqual([
      ["My orders", "/account"],
      ["Sign up", "/signup"],
      ["Log in", "/login"],
    ]);
  });

  it("renders a custom utility node, such as a logout form", () => {
    render(
      <Header
        utility={
          <form action="/logout">
            <button type="submit">Log out</button>
          </form>
        }
      />,
    );
    const utility = screen.getByRole("navigation", {
      name: "Help and account",
    });
    expect(
      within(utility).getByRole("button", { name: "Log out" }),
    ).toBeInTheDocument();
    expect(within(utility).queryByRole("link", { name: "Log in" })).toBeNull();
  });

  describe("mobile drawer", () => {
    it("opens with the nav and the utility items, and closes on Escape", () => {
      render(<Header />);
      const menu = screen.getByRole("button", { name: "Menu" });
      expect(menu).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(menu);
      const drawer = screen.getByRole("dialog", { name: "Menu" });
      expect(menu).toHaveAttribute("aria-expanded", "true");
      expect(
        within(within(drawer).getByRole("navigation", { name: "Main" }))
          .getAllByRole("link")
          .map((l) => l.textContent),
      ).toEqual(["Shoes", "Apparel", "Gear"]);
      expect(
        linkTargets(
          within(drawer).getByRole("group", { name: "Help and account" }),
        ),
      ).toEqual([
        ["My orders", "/account"],
        ["Sign up", "/signup"],
        ["Log in", "/login"],
      ]);
      expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(menu).toHaveFocus();
    });

    it("keeps Tab and Shift+Tab inside the open drawer", () => {
      render(<Header />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      const close = screen.getByRole("button", { name: "Close menu" });
      const lastLink = within(
        screen.getByRole("group", { name: "Help and account" }),
      ).getByRole("link", { name: "Log in" });

      lastLink.focus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(close).toHaveFocus();

      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(lastLink).toHaveFocus();
    });

    it("locks page scroll while open and restores it on close", () => {
      render(<Header />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(document.body.style.overflow).toBe("hidden");

      fireEvent.keyDown(document, { key: "Escape" });
      expect(document.body.style.overflow).toBe("");
    });

    it("closes and releases the page when the viewport widens past bp-md", () => {
      render(<Header />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 960px)");

      act(() => media.listeners.forEach((fn) => fn({ matches: true })));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
      expect(media.listeners.size).toBe(0);
    });

    it("closes on a backdrop click", () => {
      render(<Header />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      const backdrop = screen.getByRole("dialog").previousElementSibling!;
      fireEvent.click(backdrop);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes when the route changes", () => {
      const { rerender } = render(<Header />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      navigation.pathname = "/account";
      rerender(<Header />);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes on any link click, even one that only changes the query", () => {
      render(
        <Header
          utility={
            <a href="?tab=orders" onClick={(event) => event.preventDefault()}>
              Orders tab
            </a>
          }
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("link", {
          name: "Orders tab",
        }),
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes from the close button", () => {
      render(<Header />);
      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
