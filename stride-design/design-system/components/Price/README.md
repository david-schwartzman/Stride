# Price

Formats a price; becomes a sale price automatically when `compareAt` is higher than `amount`.

Sale prices show the new price in `sale`, the old price struck through in `ink-muted`, and the discount percentage. Always tabular numerals so prices line up in grids and the cart. Sizes: `sm` cards, `md` cart, `lg` product page.

Consumer provides the numbers (in major units, e.g. `48` = $48.00) and optional ISO `currency` (default USD).
