import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/current";

/** /login and /signup send a signed-in shopper home. Render inside <Suspense>. */
export async function RedirectIfSignedIn() {
  if (await getCurrentSession()) redirect("/");
  return null;
}
