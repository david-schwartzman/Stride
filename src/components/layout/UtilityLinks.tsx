import Link from "next/link";

// Signed-out default for the Header's utility slot (AC7). protected-routes swaps in
// its own node (e.g. a logout form) through Header's `utility` prop.
const items = [
  { label: "My orders", href: "/account" },
  { label: "Sign up", href: "/signup" },
  { label: "Log in", href: "/login" },
];

export function UtilityLinks() {
  return (
    <>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-ink no-underline hover:underline focus-visible:outline-none focus-visible:shadow-focus"
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
