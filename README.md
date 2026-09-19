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
pnpm db:seed       # load the effect presets (idempotent)
pnpm db:studio     # browse the data
pnpm test          # credit ledger + jobs + effects suites (needs DATABASE_URL)
```

`pnpm db:seed` is required once per environment, including production — `/effects`
reads the `presets` table, and an unseeded database shows an empty state rather
than a broken page.

Balances are never stored. `credit_ledger` is append-only and the balance is
`SUM(delta)`, so the ledger and the number on screen cannot drift apart. Every write
carries an idempotency key (`job:<id>:charge`, `job:<id>:refund`, `daily:<user>:<date>`),
and charges take a `SELECT ... FOR UPDATE` lock on the user row so concurrent renders
cannot overdraw.

## Generation

`POST /api/generate` validates against the model's zod schema, prices the job
server-side, runs a cheap safety pre-check, checks the capacity guards, charges
credits and only then submits to the provider. `GET /api/jobs/[id]` reconciles
with the provider while a job is active; `POST /api/jobs/[id]/cancel` stops one;
`POST /api/webhooks/fal` takes the provider's word once its ED25519 signature
verifies. Polling and webhooks both end in one `transition()`, which is the only
place a job changes status — so assets are saved once and credits come back
exactly once, whichever arrives first.

Video sits on the same engine: LTX-2.3 fast for image-to-video (start frame,
optional end frame for a transition) and text-to-video. Uploads go straight from
the browser to Vercel Blob and land in the library as `upload` assets.

Active jobs live in Postgres, not in the tab — a refresh mid-render rehydrates
the queue from the server, including anything that finished while the page was
closed.

Guards: 2 active jobs per user, 8 new guests per IP per day, and a global
`DAILY_CREDIT_CAP`. Hitting one returns a clear message; the product never
invents a result to cover for being out of capacity.

With `PROVIDER=mock`, prompt directives drive the paths that are otherwise hard
to reach: `[[fail]]` fails the job, `[[nsfw]]` gets it refused, `[[slow]]` takes
20 seconds. All three refund.

## Effects

An effect is a `presets` row (`kind='effect'`): a title, a category, a model, a
prompt template, fixed params and one required photo slot. The definitions live in
[src/lib/effects.ts](src/lib/effects.ts) so they are reviewable in a diff, and
`pnpm db:seed` upserts them into the table the app actually reads.

`POST /api/generate` accepts two shapes. The composer sends a model and its
params; an effect sends `{ presetSlug, imageUrl, extra? }` and nothing else is
read — the model, the params, the prompt and the price all come off the preset
row, so an effect cannot be steered or underpaid from the client. The compiled
prompt is stored on the job and shown in the "How this was made" drawer.

Example loops in `public/mock/effects/` were generated here with ffmpeg. They are
reference motion, not renders of the effect itself; with `PROVIDER=mock` a run
returns its own effect's loop so the demo stays coherent.

## Explore

`/` is the public feed: assets their owner made public, newest first, filtered
by Images / Videos / Effects, with infinite scroll and a detail modal carrying
the prompt, the model and "Recreate this". Nothing about the author is shown —
a guest who shares a render has not agreed to be identified.

Recreate on someone else's work cannot reopen their job, so it prefills the
matching composer from what the feed already shows (`?prompt=` and `?model=`);
an effect render opens that effect instead. While there are fewer than eight
public renders, sample tiles pad the grid — labelled "Sample", never counted as
anyone's work.

## Characters

`/characters`: 3–10 photos under a name. Nothing is trained, per AGENTS.md —
they are stored references, and the page says so where someone would otherwise
assume a fine-tune. Selecting one in Image or Cinema attaches them to the model,
and **says what it did**: how many photos a model can take is read off the
registry's capabilities, so a model that takes one of ten, or none at all,
reports that before anything is charged rather than rendering the wrong thing.

## Credits

Cost is shown before every submit, and `CreditNotice` covers the two states that
matter: running low (under one clip) and short for this render — each ending in
something to do rather than a dead end.

The header carries the balance and, once a day, a Claim button that calls
`grantDaily`. It is a button rather than an automatic top-up: credits arriving
silently teach nobody that renders cost anything.

`/pricing` has Free / Pro / Max, all labelled demo billing. "Upgrade" writes a
`purchase` row to the same ledger every render is charged against — no payment
provider is connected, there is no card form, and the button says so. Each
top-up is keyed per plan per day, so a double-click cannot buy twice.

## Cinema

A director's panel in five steps: Scene → Rig → Frames → pick the anchor →
Motion → Result.

[src/lib/cinema.ts](src/lib/cinema.ts) is a pure compiler over
[src/data/cinema.json](src/data/cinema.json) — 5 cameras, 6 lenses, 5 focal
lengths, 3 apertures, 6 genres, 6 lighting setups and 10 camera moves, each
carrying the prompt fragment it contributes. Adding a lens is a data edit. The
frame prompt takes the whole rig, because the still is where the look is fixed;
the motion prompt leads with the move and drops aperture and lighting, which
the anchor frame has already decided. `pnpm test` covers it, including that the
compiled prompt cannot outgrow what the model accepts — the scene cap is derived
from the catalogue rather than guessed.

Camera and lens options describe the look of a medium (grain, latitude, flare,
bokeh shape) rather than naming a manufacturer's product.

Frames are four widescreen candidates from one job. With no references that is
the cheap four-step model (4 credits); attach up to four reference images, or a
saved Character, and it switches to the multi-reference model, which costs what
it costs (48 credits for four). The panel shows the live price either way.

Every step is written to `cinema_projects` as you go — panel state, the frames
job, the anchor you picked and the clip. `/cinema` resumes the most recent
sequence, `?p=<id>` opens a specific one and `?new=1` starts a blank panel. The
saved step is a high-water mark, so stepping back to re-read the rig never
loses four rendered frames. `POST /api/cinema/[id]/render` takes a stage and
nothing else: the scene, rig, model, prompt and price are all recompiled from
the saved row.

Characters are reference images under a name — no training, per the brief. They
exist so a sequence can be pointed at the same person again without hunting
through the library.

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
| `pnpm db:seed`   | Load the effect presets         |

Run `pnpm typecheck && pnpm lint && pnpm build` before every commit.

## Routes

| Route             | What's there                                  |
| ----------------- | --------------------------------------------- |
| `/`               | Explore: public feed, filters, detail modal   |
| `/image`          | Image composer + recent renders               |
| `/video`          | Video composer + recent renders               |
| `/effects`        | Eight one-photo effects, filtered by category |
| `/effects/[slug]` | Example, photo slot, inline job, result       |
| `/cinema`         | Director's panel: scene, rig, frames, motion  |
| `/characters`     | 3–10 stored reference photos under a name     |
| `/library`        | Your renders (loading / empty / error states) |
| `/pricing`        | Free / Pro / Max — demo billing, no payments  |

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

After the first deploy, point `DATABASE_URL` at the Neon branch and run
`pnpm db:migrate && pnpm db:seed` against it once. Without the seed the app works
but `/effects` is empty.
