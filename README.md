# Kinora

A creative studio for AI images and video. Explore what others made, generate your own, remix anything.

Kinora is dark, media-first and guest-first: the whole product is browsable without an account, and you get credits to try a render before signing in.

## Stack

Next.js (App Router) · TypeScript · Tailwind · shadcn/ui · Postgres (Neon) + Drizzle · fal.ai behind a provider adapter · Vercel Blob · deployed on Vercel · pnpm.

## Run it

Requires Node 20+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.local   # defaults are fine for local dev
pnpm dev                     # http://localhost:3000
```

`PROVIDER=mock` is the default: generation returns sample outputs after a fake delay, so local development costs nothing. Set `PROVIDER=fal` plus `FAL_KEY` to hit the real provider.

## Database

Postgres via Drizzle. Neon is the deployment target; any other Postgres URL (a local
server, CI) works too — the driver is picked from `DATABASE_URL`.

```bash
pnpm db:generate   # write a migration from schema changes
pnpm db:migrate    # apply migrations
pnpm db:studio     # browse the data
pnpm test          # credit ledger suite (needs DATABASE_URL)
```

Balances are never stored. `credit_ledger` is append-only and the balance is
`SUM(delta)`, so the ledger and the number on screen cannot drift apart. Every write
carries an idempotency key (`job:<id>:charge`, `job:<id>:refund`, `daily:<user>:<date>`),
and charges take a `SELECT ... FOR UPDATE` lock on the user row so concurrent renders
cannot overdraw.

## Sessions

Guest-first. Middleware issues a signed, httpOnly cookie on the first request;
`getCurrentUser()` creates the user row and its 30 starter credits on the first server
render that needs them. `users.clerk_id` is reserved for real accounts later.

## Scripts

| Command          | What it does                    |
| ---------------- | ------------------------------- |
| `pnpm dev`       | Dev server                      |
| `pnpm build`     | Production build                |
| `pnpm start`     | Serve the production build      |
| `pnpm typecheck` | `tsc --noEmit`                  |
| `pnpm lint`      | ESLint (Next config + Prettier) |
| `pnpm format`    | Prettier write                  |

Run `pnpm typecheck && pnpm lint && pnpm build` before every commit.

## Routes

| Route      | What's there                                  |
| ---------- | --------------------------------------------- |
| `/`        | Hero + masonry Explore feed                   |
| `/image`   | Image composer + recent renders               |
| `/video`   | Video composer + recent renders               |
| `/effects` | One-tap camera moves and grades               |
| `/cinema`  | Shot-list sequence builder                    |
| `/library` | Your renders (loading / empty / error states) |
| `/pricing` | Credit plans (demo billing, no payments)      |

## Structure

```
src/
  app/          routes, layout, error + not-found boundaries
  components/   app shell + shared UI (MediaCard, EmptyState, ErrorState)
  components/ui shadcn primitives (button, badge, skeleton, separator)
  lib/          utils, nav, placeholder feed data
```

Placeholder tiles are rendered from seeded CSS gradients — no third-party media. They are replaced by real outputs once the jobs pipeline lands.

## Environment

See [.env.example](.env.example). Never commit `.env*` files.

## Deploy

Vercel, importing this repo. Build command `pnpm build`, output handled by the Next.js preset. Set the environment variables from `.env.example` in the Vercel project (start with `PROVIDER=mock`).
