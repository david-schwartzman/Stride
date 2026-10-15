import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api-client";

/** /login and /signup send a signed-in shopper home. Render inside <Suspense>. */
export async function RedirectIfSignedIn() {
  // Per-shopper: never served from Next's fetch cache.
  const res = await apiFetch("/auth/me", { cache: "no-store" });
  if (res.status === 200) redirect("/");
  return null;
}
