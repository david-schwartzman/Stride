# Accounts & Auth — Tech Plan

> Epic: epic.md · Product: ../../mission.md

## Approach

Auth.js with the Credentials provider; passwords hashed with bcrypt. /signup and /login are server-rendered pages with small client forms that call Server Actions, validated with the same Zod schemas on client and server. Session in an httpOnly cookie (Auth.js, AUTH_SECRET). Next.js middleware guards /checkout, /account, /wishlist and redirects to /login?callbackUrl=<path>; after login we redirect back to callbackUrl (same-origin paths only). The header reads the session server-side to show logged-in state and a logout action.

## Architecture Impact

- New User model + migration (email unique, password hash, name).
- Auth.js config, /login and /signup routes, middleware for protected routes.
- New env var AUTH_SECRET (Vercel + local).
- Header gets a session-aware account/login state.
- No new external services (Auth.js runs in the app).

## Risks & Unknowns

- Auth.js Credentials provider + database sessions vs. JWT sessions: Credentials works best with JWT. Decide in the first spec.
- The Auth.js v5 / App Router API changes often, so pin the version and follow its docs.
- Return-to redirect must only allow internal paths (open-redirect risk).
- Login brute force: there's no rate limiting in v1. Note it as a known gap.
- Spike: a short Auth.js Credentials + middleware proof on a Vercel preview before building forms.

## Candidate Specs

- `signup-login` — User model, Auth.js Credentials, sign-up/login/logout with inline errors
- `protected-routes` — middleware for /checkout, /account, /wishlist with safe return-to redirect, plus header session state
