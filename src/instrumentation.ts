// Runs once when a server instance starts. Checking the pepper here makes a
// misconfigured deploy fail at boot rather than at the first login.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPepper } = await import("@/lib/auth/password");
    getPepper();
  }
}
