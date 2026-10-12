# Input

Labelled text field for sign-in, sign-up, checkout and the newsletter.

- The label is always visible (uppercase `label` style) — placeholders are examples, never labels.
- `hint` sits below in `ink-muted`; `error` replaces it in `sale` with a 2px border and `aria-invalid`.
- Validate on blur, not on every keystroke. Error text says how to fix it: *Enter a valid postcode*, not *Invalid*.

Passes every other prop (`type`, `name`, `autoComplete`, `value`, `onChange`…) to the `<input>`. Use the right `autoComplete` values at checkout.
