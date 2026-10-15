import { Logger } from "@nestjs/common";

const logger = new Logger("Auth");

export const signInHooks = {
  /**
   * Runs once right after a shopper signs in (login or sign-up), before the
   * response. A no-op today: cart-checkout's guest-cart-merge plugs in here
   * (softwareos/products/stride/epics/cart-checkout/tech-plan.md).
   *
   * Called through runOnSignedIn, so a throw is logged and sign-in still succeeds.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onSignedIn(userId: string): Promise<void> {},
};

/** Calls the post-sign-in hook; a failure there must never block sign-in. */
export async function runOnSignedIn(userId: string): Promise<void> {
  try {
    await signInHooks.onSignedIn(userId);
  } catch (error) {
    // userId and error only: never the request body or password (AC13).
    if (error instanceof Error) {
      logger.error(`onSignedIn failed for user ${userId}`, error.stack);
    } else {
      logger.error(`onSignedIn failed for user ${userId}: ${String(error)}`);
    }
  }
}
