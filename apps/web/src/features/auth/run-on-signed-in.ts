import { onSignedIn } from "./hooks";

/** Calls the post-sign-in hook; a failure there must never block sign-in (AC10). */
export async function runOnSignedIn(userId: string): Promise<void> {
  try {
    await onSignedIn(userId);
  } catch (error) {
    // userId and error only: never the form data or password.
    console.error("onSignedIn failed", { userId, error });
  }
}
