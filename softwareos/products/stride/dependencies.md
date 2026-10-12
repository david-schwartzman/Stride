# Dependencies

## Internal

(none)

## External

| Service | Purpose | Auth method | Docs |
|---|---|---|---|
| Neon | PostgreSQL hosting (database) | `DATABASE_URL` connection string (env var) | TBD |
| Vercel | Hosting + preview deploys | GitHub integration | TBD |
| GitHub + GitHub Actions | Repo, PRs, CI | GitHub account | TBD |
| Figma (via MCP) | Design source of truth | OAuth | TBD |
| Google Stitch | UI generation — design-time only, not used by the running app | TBD | TBD |

No payments, email or analytics services in v1. Auth is an in-app module (`src/lib/auth/`), not an external service; its secrets `PASSWORD_PEPPER` and `GUEST_CART_SECRET` are env vars.
