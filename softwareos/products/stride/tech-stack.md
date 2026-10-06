# Tech Stack

Same technologies as `softwareos/standards/global/tech-stack.md`.

## Frontend

- Next.js (App Router) with React and TypeScript
- Tailwind CSS for styling
- `next/image` for optimized product images

## Backend

- Built into Next.js — no separate server
- Server Components for reads
- Server Actions for mutations (cart, wishlist, checkout, auth)
- Route Handlers only where an HTTP endpoint is needed
- Zod for input validation on both client and server

## Auth

- Auth.js (NextAuth) with email + password credentials
- Passwords hashed with bcrypt
- Session stored in an httpOnly cookie

## Database

- PostgreSQL hosted on Neon (serverless Postgres)
- Prisma ORM with migrations and a seed script for the product catalog

## Testing

- Vitest + React Testing Library for unit/component tests
- Playwright for end-to-end tests of the shopping flow

## Other

- Vercel hosting, with a preview deployment per PR
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
| Server Actions | Express | One app and one deploy instead of two servers |
| PostgreSQL | MongoDB | Orders, items, products and stock are relational and need consistency |
| Neon | Local Docker Postgres | Free, no local setup, works with Vercel previews |
| Prisma | Drizzle | Type-safe, easy migrations and seeding, more beginner-friendly |
| Auth.js | Clerk | No paid external service; auth logic stays in the app |
| Vercel | Netlify / Render | Built for Next.js; preview link per PR |
| Images in `/public` | Cloudinary | ~30 products don't need an image service |
| Mock payment | Stripe test mode | Real payments are OUT for v1 |
| Vitest | Jest | Faster, less config |

## SSR Boundary

**Server-rendered:** Home, Catalog (including search/filter results via URL params), Product detail, Account, Order history, Wishlist page, Confirmation.
*Reason:* fast first paint, SEO for product pages, data stays on the server.

**Client components:** add-to-cart button, size selector, quantity +/-, wishlist heart, search box and filter controls (they update the URL), checkout / login / signup forms.
*Reason:* they need instant interaction and form state.
