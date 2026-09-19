# Kinora — Agent Brief

**Kinora** is the product name. Use it everywhere: package name, page titles, metadata, UI copy, README. Never use another name.

## Project

Kinora is a creative studio for AI images and videos — an original product inspired by the Higgsfield AI category, not a clone of it.

This is a 24-hour build. Judged on:
1. Working product shipped fast
2. Product judgement
3. UX / UI

**The live URL must work for a logged-out visitor.** Never ship a change that puts a login wall in front of the first impression.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind + shadcn/ui
- Postgres (Neon) + Drizzle ORM
- fal.ai behind a provider adapter
- Vercel Blob for uploads
- Deployed on Vercel
- pnpm (never npm/yarn)

## Core loop

Explore feed → Generate (image / video) → async job with live status → Library → Recreate / remix.

Extras once the loop is solid: Effects presets, mini Cinema Studio, credits.

## Scope

**Build**
- Guest-first accounts (usable before sign-up)
- Model registry
- Async jobs
- Credit ledger
- Image page, Video page
- Library
- Effects
- Cinema flow
- Explore feed

**Stub**
- Characters — reference images only, no training
- Billing — demo only, no payments

**Cut (do not build)**
- Agents, canvas, audio/lipsync, plugins, enterprise features, mobile app

## Rules

- **Commits:** small, one feature each. Prefix `feat:`, `fix:`, `chore:`. Run typecheck + lint + build before every commit.
- **Providers:** `PROVIDER=mock|fal`. Mock returns sample outputs after a fake delay, so development costs nothing. Default to mock locally.
- **Credits:** checked server-side before any provider call. Never trust the client.
- **States:** every async view has loading, empty and error states. No exceptions.
- **Design:** dark, cinematic, media-first. Responsive down to 390px.
- **Identity:** do not copy Higgsfield's logo, copy or media. Own identity, own generated content.
- **Secrets:** never read, print or echo `.env*` files or secret values. Agent logs are committed to a public repo.
- **Logs:** keep `.agent-logs/` intact and committed.
