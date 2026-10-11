# SizePicker

Grid of size chips on the product page; works as a radio group.

- Selected: ink fill. Sold out: struck through, hatched, disabled and announced as *sold out*.
- The chosen size echoes next to the legend.
- Until a size is chosen, the *Add to bag* button stays disabled with the hint *Select a size*.
- Pair with a *Size guide* ghost button.

Sizes are strings (`'M'`, `'42'`, `'US 9'`) or `{label, available}`. Controlled via `value` + `onChange`, or uncontrolled with `defaultValue`.
