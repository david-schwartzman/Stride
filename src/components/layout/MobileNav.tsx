"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { HeaderLink } from "./Header";

interface MobileNavProps {
  links: HeaderLink[];
  /** the Header's utility content, repeated in the drawer (the utility row is hidden below bp-md) */
  utility: ReactNode;
}

// Menu button + drawer shown below bp-md in place of the Header's nav (AC7).
export function MobileNav({ links, utility }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState(pathname);

  // Close after navigating, including via links inside the utility slot.
  if (open && openedOn !== pathname) {
    setOpen(false);
    setOpenedOn(pathname);
  }

  useEffect(() => {
    if (open) {
      closeButton.current?.focus();
    } else if (wasOpen.current) {
      menuButton.current?.focus();
    }
    wasOpen.current = open;
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      // aria-modal: keep Tab / Shift+Tab inside the drawer.
      const focusable = dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !dialog.current.contains(active))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.current.contains(active))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    // Stop the page scrolling underneath the drawer.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={menuButton}
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => {
          setOpenedOn(pathname);
          setOpen(true);
        }}
        className="relative grid size-10 cursor-pointer place-items-center rounded-pill text-ink before:absolute before:-inset-0.5 before:content-[''] hover:bg-surface-alt focus-visible:outline-none focus-visible:shadow-focus md:hidden"
      >
        <Menu aria-hidden="true" className="size-[22px]" strokeWidth={2} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-30 md:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-surface-inverse/40"
            onClick={() => setOpen(false)}
          />
          {/* Any link click closes the drawer, including utility-slot links and
              links that only change the query string (the pathname check misses those). */}
          <div
            ref={dialog}
            id="mobile-nav"
            onClick={(event) => {
              if ((event.target as Element).closest("a")) setOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col gap-6 overflow-y-auto bg-surface p-4 shadow-raised"
          >
            <button
              ref={closeButton}
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="relative grid size-10 cursor-pointer place-items-center self-end rounded-pill text-ink before:absolute before:-inset-0.5 before:content-[''] hover:bg-surface-alt focus-visible:outline-none focus-visible:shadow-focus"
            >
              <X aria-hidden="true" className="size-[22px]" strokeWidth={2} />
            </button>
            <nav aria-label="Main" className="flex flex-col">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex min-h-11 items-center border-b border-line font-display text-2xl font-bold uppercase text-ink focus-visible:outline-none focus-visible:shadow-focus"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div
              aria-label="Help and account"
              role="group"
              className="flex flex-col text-sm [&_a]:flex [&_a]:min-h-11 [&_a]:items-center"
            >
              {utility}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
