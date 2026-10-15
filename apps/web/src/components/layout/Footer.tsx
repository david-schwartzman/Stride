import Link from "next/link";

// Per stride-design/pages/Footer.dc.html (AC8). Shop links point at catalog filters
// built by later epics; they may 404 until then.
const columns = [
  {
    title: "Shop by run",
    links: [
      { label: "Road", href: "/catalog?run=road" },
      { label: "Trail", href: "/catalog?run=trail" },
      { label: "Race day", href: "/catalog?run=race-day" },
    ],
  },
  {
    title: "Shop",
    links: [
      { label: "Shoes", href: "/catalog?category=shoes" },
      { label: "Apparel", href: "/catalog?category=apparel" },
      { label: "Gear", href: "/catalog?category=gear" },
    ],
  },
  {
    title: "Your account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "My orders", href: "/account" },
      { label: "Wishlist", href: "/wishlist" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-surface-inverse font-sans text-on-inverse">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-4 pt-12 pb-8 md:px-8">
        <div className="flex flex-col gap-12 md:flex-row md:flex-wrap md:justify-between">
          <div className="flex flex-col gap-3 md:flex-[1_1_260px]">
            <span className="inline-flex items-center gap-1.5 font-display text-4xl font-extrabold uppercase tracking-[0.02em]">
              Stride
              <span
                aria-hidden="true"
                className="inline-block h-[30px] w-3 -skew-x-[18deg] bg-volt"
              />
            </span>
            <p className="m-0 max-w-[260px] text-sm leading-5">
              Less choice. Clearer guidance. Faster decisions. Running gear for
              your first 5K and 10K.
            </p>
          </div>
          {columns.map((column) => (
            <nav
              key={column.title}
              aria-label={column.title}
              className="flex flex-col gap-2.5 md:flex-[0_1_180px]"
            >
              <span className="text-xs font-bold uppercase tracking-[0.08em] opacity-75">
                {column.title}
              </span>
              {column.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="self-start text-sm leading-5 text-on-inverse no-underline hover:underline focus-visible:outline-none focus-visible:shadow-focus"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-ink-muted pt-5 text-xs leading-4">
          <span>© 2026 Stride · A Moveo Academy capstone · Prices in USD</span>
          <span>$5 shipping · free on orders over $75</span>
        </div>
      </div>
    </footer>
  );
}
