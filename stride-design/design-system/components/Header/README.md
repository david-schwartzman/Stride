# Header

Site header on every page: optional promo bar (`surface-inverse`), the **STRIDE** wordmark with its volt slash, main nav (Shoes · Apparel · Gear), and search / account / wishlist / cart icons.

- `active` underlines the current section in ink.
- `utility`: a small grey row of help/account links above the bar (*Help · Orders · Sign in*), as on the big sports stores.
- Cart count is a volt dot; hidden when 0. The cart button's label includes the count for screen readers.
- Signed in: pass `accountName` — a green dot appears on the account icon and its label says who is signed in.
- Pass `wishlistHref` to show the heart icon (wishlist needs login; guests go to `/login`).
- Make it sticky on scroll. Below `bp-md`, replace the nav with a menu button opening a drawer (build it from the same links).

Consumer provides `links`, `active`, `cartCount`, and for each icon either an `…Href` (renders a link) or an `on…` handler (renders a button).
