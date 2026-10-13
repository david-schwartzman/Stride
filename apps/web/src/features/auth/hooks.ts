/**
 * Runs once right after a shopper signs in (login or sign-up), before the
 * redirect. A no-op today: cart-checkout's guest-cart-merge plugs in here
 * (softwareos/products/stride/epics/cart-checkout/tech-plan.md).
 *
 * Called through runOnSignedIn, so a throw is logged and sign-in still succeeds.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function onSignedIn(userId: string): Promise<void> {}
