import { Heart, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MobileNav } from "./MobileNav";
import { UtilityLinks } from "./UtilityLinks";

// Based on stride-design/design-system/components/Header (bundle.css .st-header).
export interface HeaderLink {
  label: string;
  href: string;
}

export interface HeaderProps {
  /** shown in the bag icon's volt dot; hidden when 0 */
  cartCount?: number;
  /** signed-in customer's name: green dot on the account icon */
  accountName?: string;
  /**
   * Content of the grey utility row (and of the mobile drawer). Any nodes, not only
   * links, so protected-routes can place a logout form here. Defaults to the
   * signed-out links: My orders · Sign up · Log in.
   */
  utility?: ReactNode;
}

const links: HeaderLink[] = [
  { label: "Shoes", href: "/catalog?category=shoes" },
  { label: "Apparel", href: "/catalog?category=apparel" },
  { label: "Gear", href: "/catalog?category=gear" },
];

// 40px visual, pseudo-element stretches the touch target to 44px.
const iconButton =
  "relative grid size-10 place-items-center rounded-pill text-ink before:absolute before:-inset-0.5 before:content-[''] hover:bg-surface-alt focus-visible:outline-none focus-visible:shadow-focus";

export function Header({
  cartCount = 0,
  accountName,
  utility = <UtilityLinks />,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <nav
        aria-label="Help and account"
        className="hidden justify-end gap-4 bg-surface-alt px-8 py-1.5 text-xs md:flex"
      >
        {utility}
      </nav>
      <div className="flex h-14 items-center gap-2 px-4 md:h-16 md:gap-8 md:px-8">
        <MobileNav links={links} utility={utility} />
        <Link
          href="/"
          aria-label="Stride home"
          className="mr-auto inline-flex items-center gap-0.5 font-display text-[26px] font-extrabold uppercase tracking-[0.02em] text-ink no-underline focus-visible:outline-none focus-visible:shadow-focus md:mr-0 md:text-[30px]"
        >
          Stride
          <i
            aria-hidden="true"
            className="ml-1 inline-block h-[26px] w-2.5 -skew-x-[18deg] bg-volt"
          />
        </Link>
        <nav
          aria-label="Main"
          className="hidden flex-1 flex-wrap gap-6 md:flex"
        >
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="border-b-[3px] border-transparent py-2 text-sm font-semibold uppercase tracking-[0.04em] text-ink no-underline hover:border-line-strong focus-visible:outline-none focus-visible:shadow-focus"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {/* Visual placeholder only — catalog-search wires search to the URL. */}
        <div
          role="search"
          className="hidden h-10 flex-[0_1_300px] items-center gap-2 rounded-pill bg-surface-alt px-4 text-ink-muted focus-within:shadow-focus md:flex"
        >
          <Search aria-hidden="true" className="size-[18px] flex-none" />
          <input
            type="search"
            name="q"
            aria-label="Search products"
            placeholder="Search shoes, apparel, gear"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Search"
            className={`${iconButton} cursor-pointer md:hidden`}
          >
            <Search aria-hidden="true" className="size-[22px]" />
          </button>
          <Link
            href={accountName ? "/account" : "/login"}
            aria-label={
              accountName ? `Account, signed in as ${accountName}` : "Account"
            }
            className={iconButton}
          >
            <User aria-hidden="true" className="size-[22px]" />
            {accountName ? (
              <span
                aria-hidden="true"
                className="absolute right-1.5 bottom-1.5 size-2 rounded-pill bg-success shadow-[0_0_0_2px_var(--surface)]"
              />
            ) : null}
          </Link>
          <Link href="/wishlist" aria-label="Wishlist" className={iconButton}>
            <Heart aria-hidden="true" className="size-[22px]" />
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
            className={iconButton}
          >
            <ShoppingBag aria-hidden="true" className="size-[22px]" />
            {cartCount > 0 ? (
              <span
                aria-hidden="true"
                data-testid="cart-count"
                className="absolute top-0.5 right-0 h-[18px] min-w-[18px] rounded-pill bg-volt px-1 text-center text-[11px] leading-[18px] font-bold text-on-volt shadow-[0_0_0_2px_var(--surface)]"
              >
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}
