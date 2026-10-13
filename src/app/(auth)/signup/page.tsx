import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RedirectIfSignedIn } from "@/features/auth/RedirectIfSignedIn";
import { SignupForm } from "@/features/auth/SignupForm";

export const metadata: Metadata = { title: "Create an account · Stride" };

export default function SignupPage() {
  return (
    <>
      {/* Reads the session cookie, so it renders per request; the form stays in the static shell. */}
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-[clamp(40px,6vw,56px)] leading-[0.95] font-extrabold uppercase">
          Create an account
        </h1>
        <p className="m-0 text-base leading-6 text-ink-muted">
          Check out, save a wishlist and see your orders.
        </p>
      </div>
      <SignupForm />
      <p className="m-0 flex flex-wrap justify-center gap-2 border-t border-line pt-4 text-[15px]">
        <span>Already have an account?</span>
        <Link
          href="/login"
          className="font-bold text-ink underline hover:text-ink-muted"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
