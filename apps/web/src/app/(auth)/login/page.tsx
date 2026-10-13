import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/LoginForm";
import { RedirectIfSignedIn } from "@/features/auth/RedirectIfSignedIn";

export const metadata: Metadata = { title: "Log in · Stride" };

export default function LoginPage() {
  return (
    <>
      {/* Reads the session cookie, so it renders per request; the form stays in the static shell. */}
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <h1 className="m-0 font-display text-[clamp(40px,6vw,56px)] leading-[0.95] font-extrabold uppercase">
        Log in
      </h1>
      <LoginForm />
      <p className="m-0 flex flex-wrap justify-center gap-2 border-t border-line pt-4 text-[15px]">
        <span>New to Stride?</span>
        <Link
          href="/signup"
          className="font-bold text-ink underline hover:text-ink-muted"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
