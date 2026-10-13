# Tech Stack

Same technologies as `softwareos/standards/global/tech-stack.md`.

## Frontend

- Next.js (App Router) with React and TypeScript
- Tailwind CSS for styling
- `next/image` for optimized product images

## Backend

- Separate NestJS service (`apps/api`, Node 24) in the same monorepo, deployed as its own Vercel project; the only code that talks to the database
- Web (`apps/web`) reaches it through a same-origin `/api/*` rewrite (browser) or `API_URL` (Server Components, server-to-server)
- Server Components read through the API; client forms send writes to `/api/*` — no Server Actions for data
- Zod for input validation on both client and server, schemas shared from `packages/shared`

## Auth

- In-house auth module in the API (`apps/api/src/auth/`) with email + password — no auth library
- Opaque database sessions: random 256-bit token in an HttpOnly `__Host-stride_session` cookie; only its SHA-256 hash is stored in the `Session` table (30-day sliding, 90-day absolute)
- Passwords hashed with Argon2id + per-user salt + server-side pepper (`@node-rs/argon2`); 12–128 characters
- Login throttling per account and per IP, stored in Postgres
- `@oslojs/crypto` + `@oslojs/encoding` for token generation and hashing

## Database

- PostgreSQL hosted on Neon (serverless Postgres), connected to the API project only
- Prisma 6 ORM (pinned major; Prisma 7 moves `directUrl` to `prisma.config.ts` and needs a driver adapter) with migrations and a seed script for the product catalog

## Testing

- Vitest + React Testing Library for unit/component tests
- Playwright for end-to-end tests of the shopping flow

## Other

- Vercel hosting: two projects (web, API), each with a preview deployment per PR
- GitHub Actions CI: lint, typecheck, tests on every PR
- Product images stored in the repo under `/public`
- Payment is mocked (no real payment provider)
- Figma as design source of truth (via MCP); Google Stitch for UI generation
- TypeScript strict mode; ESLint + Prettier
- Server-render by default; client components only where interaction requires it

## Alternatives Considered

| Choice | Over | Why |
|---|---|---|
| Next.js | React + Vite | Vite is client-only by default; products would load late and crawlers would see an empty page |
| NestJS API (`apps/api`) | Server Actions in Next.js | Tech-lead decision 2026-10-13: a clear frontend / backend split with the backend owned as its own service |
| ~~Server Actions~~ | ~~Express~~ | ~~One app and one deploy instead of two servers~~ — superseded 2026-10-13 by the NestJS API |
| PostgreSQL | MongoDB | Orders, items, products and stock are relational and need consistency |
| Neon | Local Docker Postgres | Free, no local setup, works with Vercel previews |
| Prisma | Drizzle | Type-safe, easy migrations and seeding, more beginner-friendly |
| Own session module | Auth.js, Clerk | Auth.js email + password (Credentials) supports JWT sessions only, which can't be revoked; Clerk is a paid external service. About 150 lines we own and test |
| Database sessions | JWT sessions | Instant logout and revoke per device; a leaked DB holds only token hashes. Costs one indexed lookup per request |
| Argon2id + pepper | bcrypt | OWASP's first choice, memory-hard; bcrypt silently ignores bytes past 72 |
| Vercel | Netlify / Render | Built for Next.js, runs NestJS natively; preview link per PR; one account for both apps |
| Images in `/public` | Cloudinary | ~30 products don't need an image service |
| Mock payment | Stripe test mode | Real payments are OUT for v1 |
| Vitest | Jest | Faster, less config |

## SSR Boundary

**Server-rendered:** Home, Catalog (including search/filter results via URL params), Product detail, Account, Order history, Wishlist page, Confirmation.
*Reason:* fast first paint, SEO for product pages, data stays on the server.

**Client components:** add-to-cart button, size selector, quantity +/-, wishlist heart, search box and filter controls (they update the URL), checkout / login / signup forms.
*Reason:* they need instant interaction and form state.
