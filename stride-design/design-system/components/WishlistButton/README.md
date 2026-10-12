# WishlistButton

Heart toggle that saves a product to the signed-in customer's wishlist.

- `icon` (default): a round 40px heart, used top-right on every `ProductCard`.
- `full`: a labelled pill (*Add to wishlist* / *Saved to wishlist*) under *Add to bag* on the product page.
- Filled heart = saved. `aria-pressed` carries the state for screen readers.
- Wishlist needs login: when a guest taps it, send them to `/login` and come back.

Consumer provides `active` + `onToggle` (a Server Action that adds/removes the WishlistItem), or `defaultActive` for an uncontrolled demo.
