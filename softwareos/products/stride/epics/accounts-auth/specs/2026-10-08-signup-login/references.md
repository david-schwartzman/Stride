# References for Sign-up & Login

## Related Specs

- **[Considered]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) — matched weakly on `/login`, `/signup` in its spec.md body; dismissed in Step 4d: it only links the header account icon to `/login` and explicitly hands these pages to signup-login.
- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) — this spec edits two files app-foundation covers: `prisma/schema.prisma` (adds the User model, handed off by app-foundation) and `.github/workflows/ci.yml`. app-foundation anticipated adding a Neon branch to CI when signup-login's e2e needs a database; this spec uses a `postgres:16` service container instead (simpler, no Neon credentials in CI). Kept separate because app-foundation owns the scaffold; these are additive hand-offs it planned for.
- **[Related]** [cart-checkout tech plan](../../../cart-checkout/tech-plan.md) — `guest-cart-merge` implements the `onSignedIn(userId)` hook defined here in `src/features/auth/hooks.ts`, called from the login/signup Server Actions. Resolves that plan's open "merge-on-login hook dependency" risk.

## Upstream Meeting

None.

## Similar Implementations

Greenfield — no app code exists yet. The references are the design handoff (used in place, not copied into `visuals/`) and app-foundation's primitives.

### Login & Signup pages

- **Location:** `stride-design/pages/Login.dc.html`, `stride-design/pages/Signup.dc.html`
- **Relevance:** Layout and copy for AC1, AC2, AC4, AC5.
- **Key patterns:** Split panel ("Welcome back — Your cart, wishlist and orders are waiting." / "Join Stride — Save a wishlist, check out faster and see every order in one place."), hidden at mobile. Fields: Name / Email / Password; hint "At least 8 characters."; errors "That password isn't right. Try again." and "An account with this email already exists. Log in instead."; links "New to Stride? Create an account" / "Already have an account? Log in". The Login "Log in to check out… cart is saved" banner belongs to protected-routes. Visual reference only — rebuild, don't copy.

### Input guidance

- **Location:** `stride-design/design-system/components/Input/README.md`
- **Relevance:** AC7, AC8.
- **Key patterns:** Visible label; `hint` replaced by `error` with `aria-invalid`; validate on blur, not every keystroke; error text says how to fix it.

### app-foundation primitives

- **Location:** `src/components/ui/Input`, `src/components/ui/Button` (built by app-foundation T9–T10)
- **Relevance:** The forms compose these rather than adding new inputs.
