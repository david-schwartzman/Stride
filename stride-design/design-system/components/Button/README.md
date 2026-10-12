# Button

Pill-shaped, uppercase, bold — the one round shape in Stride.

- **primary** (ink fill): the default action — *Checkout*, *Shop now*, *Sign in*.
- **accent** (volt fill, on-volt text): the money action, **one per screen** — *Add to bag* on the product page, *Place order* at checkout.
- **outline**: secondary actions next to a primary — *View details*, *Continue shopping*.
- **ink**: secondary filled CTA on light pages — *Shop men*, *Read the guide*.
- **light**: outline for ink backgrounds (hero, footer).
- **ghost**: low-emphasis, link-like — *Size guide*, *Clear filters*.

Sizes: `md` (48px, default — meets touch-target size) and `sm` (36px, filter bars and inline forms only). `fullWidth` on mobile product pages and in the cart summary.

`arrow` adds a trailing → for navigation CTAs (*Shop shoes →*); not for actions like *Add to bag*. Links styled as buttons reuse the same classes: `<a class="st-btn st-btn--accent st-btn--md">`.

Labels are verbs, 1–3 words. Disabled buttons say why nearby (e.g. *Select a size*). Consumer provides `onClick` and any `type="submit"`.
