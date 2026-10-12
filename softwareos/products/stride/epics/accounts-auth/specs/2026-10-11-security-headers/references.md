# References for Security Headers

## Related Specs

_None._ The pre-flight coverage search (cross-epic) found no overlaps. These two specs are prerequisites that this spec edits for wiring, but it doesn't claim their files:

- **[Related]** [2026-10-08-app-foundation](../2026-10-08-app-foundation/spec.md) owns `next.config.ts`. This spec adds `headers()` and `poweredByHeader: false` there (T4). It stays separate because app-foundation owns the build config as a whole, while this spec owns only the header values in `src/lib/security-headers.ts`.
- **[Related]** [2026-10-11-protected-routes](../2026-10-11-protected-routes/spec.md) owns `src/proxy.ts` / `src/middleware.ts` and `PROTECTED_PREFIXES` in `src/features/session/guard.ts`. This spec makes the proxy set `Cache-Control: private, no-store` on private paths (T5) and reuses `PROTECTED_PREFIXES`. It stays separate because the guard's redirect logic is protected-routes' concern, while caching policy is this spec's.

## Similar Implementations

No application code exists yet (`src/` not scaffolded).

### Sibling specs

- **Location:** `../2026-10-08-app-foundation/spec.md`, `../2026-10-11-protected-routes/spec.md`
- **Relevance:** they define the files this spec wires into, and the static/PPR shell (protected-routes' `<Suspense>`-wrapped `HeaderSession`) that the no-nonce CSP preserves.
- **Key patterns:** a pure, unit-testable module behind a thin adapter (protected-routes' `guard.ts` + proxy). `security-headers.ts` follows the same shape.

### External guidance

- **Next.js CSP guide, "Without Nonces":** static CSP set in `next.config` `headers()`, with `script-src 'self' 'unsafe-inline'` (plus `'unsafe-eval'` in dev). It also notes that Cache-Control set in `next.config` is overwritten for pages, which is why T5 sets it in the proxy.
- **Vercel Toolbar CSP allowlist:** the origins preview deployments need, pinned exactly in AC7 (`vercel.live`, `vercel.com`, `assets.vercel.com`, `wss://ws-us3.pusher.com`). Used only when `VERCEL_ENV === "preview"`.
