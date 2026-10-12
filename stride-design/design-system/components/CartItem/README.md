# CartItem

One line in the cart drawer and cart page.

Anatomy: thumbnail · name, variant (*Colour / Size*), optional note badge · quantity stepper + *Remove* · line total (price × quantity) on the right.

Rows are divided by `line` hairlines. Consumer provides `onQuantityChange` and `onRemove`, and recomputes totals. Show a *Low stock* style note when quantity is capped by stock.
