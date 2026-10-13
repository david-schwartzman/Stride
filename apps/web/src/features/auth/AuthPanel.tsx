"use client";

import { usePathname } from "next/navigation";

// Left panel of the auth split layout (stride-design/pages/Login.dc.html,
// Signup.dc.html). Client-side only to pick the copy for the current route.
// ProductArt (the shoe illustration above the copy) isn't ported yet.
const COPY = {
  login: {
    title: "Welcome back",
    body: "Your cart, wishlist and orders are waiting.",
  },
  signup: {
    title: "Join Stride",
    body: "Save a wishlist, check out faster and see every order in one place.",
  },
} as const;

export function AuthPanel() {
  const copy = usePathname() === "/signup" ? COPY.signup : COPY.login;

  return (
    <aside className="relative hidden min-h-[560px] flex-[1_1_420px] flex-col justify-end gap-3 overflow-hidden bg-surface-inverse p-10 text-on-inverse md:flex">
      <span className="font-display text-[64px] leading-[0.9] font-extrabold uppercase">
        {copy.title}
      </span>
      <span className="max-w-[360px] text-base leading-6">{copy.body}</span>
    </aside>
  );
}
