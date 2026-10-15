# Dependencies

## Internal

(none)

## External

| Service | Purpose | Auth method | Docs |
|---|---|---|---|
| Neon | PostgreSQL hosting (database), connected to the API project | `DATABASE_URL` connection string (API env var) | TBD |
| Vercel | Hosting + preview deploys — two projects: web (Next.js) and API (NestJS) | GitHub integration | TBD |
| GitHub + GitHub Actions | Repo, PRs, CI | GitHub account | TBD |
| Figma (via MCP) | Design source of truth | OAuth | TBD |
| Google Stitch | UI generation — design-time only, not used by the running app | TBD | TBD |

No payments, email or analytics services in v1. Auth is an in-house module of our own API (`apps/api/src/auth/`), not an external service; its secrets `PASSWORD_PEPPER` and `GUEST_CART_SECRET` are API env vars. The web app's backend settings (all server-only) are `API_URL`, `WEB_PROXY_SECRET` (the same value as the API's) and, on Preview only, `API_PROTECTION_BYPASS_SECRET`; until `auth-api-migration` moves the auth code into the API, the web also keeps temporary copies of `DATABASE_URL`, `DIRECT_URL` and `PASSWORD_PEPPER`.
