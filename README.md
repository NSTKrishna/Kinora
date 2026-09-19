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
