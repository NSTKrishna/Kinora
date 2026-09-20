# Running and deploying Kinora

Target setup: **real image generation, mocked video, everything else live.**

| Piece | Runs on | Cost |
| --- | --- | --- |
| Image generation | Cloudflare Workers AI (`flux-1-schnell`) | free, ~170 images/day |
| Video generation | Kinora's mock | free |
| Image storage + uploads | Cloudinary | free tier |
| Database | Neon Postgres | free tier |
| Hosting | Vercel | free Hobby plan |

Nothing here needs a credit card.

---

## 1. Accounts and keys

Create these three, then keep the values to hand. **Paste them into `.env.local` yourself — never into a chat or a commit.**

### Cloudflare Workers AI — image generation
1. dash.cloudflare.com → **Workers & Pages** → copy the **Account ID** from the right-hand sidebar
2. dash.cloudflare.com/profile/api-tokens → **Create Token** → template **Workers AI (Read)** → create → copy the token

### Cloudinary — uploads and generated stills
1. cloudinary.com → sign up → **Console** → **Product Environment Credentials**
2. Copy **Cloud name**, **API Key**, **API Secret**

### Neon — the database (needed for Vercel, optional locally)
1. neon.tech → new project → copy the **pooled** connection string
2. It looks like `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require`
   — the `-pooler` host matters, and so does `sslmode=require`

---

## 2. Local

Add to `.env.local`:

```
PROVIDER=hybrid
MOCK_KINDS=video

CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

DAILY_CREDIT_CAP=5000
```

What those two top lines do:

- `PROVIDER=hybrid` — run real providers, but if one refuses us (exhausted balance, bad key, outage) serve a **placeholder badged as one** instead of failing. A demo never dies mid-interview.
- `MOCK_KINDS=video` — video never reaches a paid provider at all. Stills are free on Cloudflare; clips are billed per second, so they stay mocked.

Then:

```bash
pnpm install
pnpm db:migrate     # creates the 9 tables
pnpm db:seed        # loads the 8 effect presets
pnpm dev
```

Check http://localhost:3000/api/health. You want:

```json
"providers": { "mode": "hybrid", "image": "cloudflare", "video": "mock" },
"uploads": "cloudinary"
```

If `image` says `fal`, the Cloudflare variables are not being read. If `uploads` says
`unconfigured`, one of the three Cloudinary values is missing.

---

## 3. Deploy to Vercel

The local Postgres in your current `.env.local` **will not work from Vercel** — it is not
reachable from the internet. Use the Neon URL.

1. Push the repo to GitHub
2. vercel.com → **Add New… → Project** → import the repo → framework auto-detects Next.js
3. Add every variable from §2 **plus** `DATABASE_URL` (the Neon one), `SESSION_SECRET`
   (`openssl rand -base64 32`), and `NEXT_PUBLIC_APP_URL` set to the deployment URL
4. Deploy

Then run the migrations against Neon, from your machine:

```bash
DATABASE_URL='<neon url>' pnpm db:migrate
DATABASE_URL='<neon url>' pnpm db:seed
```

Finally re-check `https://<your-app>.vercel.app/api/health`.

### Why the app works on Vercel without a cron

Renders are polled by the browser and swept opportunistically when any request comes in,
so there is no background worker to schedule. A job abandoned for more than 15 minutes is
failed and refunded by the next request that happens to pass through.

---

## 4. What the interviewer will see

- **Explore** (`/`) — public feed, seeded with credited reference footage so it is never empty
- **Effects** (`/effects`) — pick one, upload a photo, get a clip. Photo goes browser → Cloudinary
- **Cinema** (`/cinema`) — the director's-panel flow: scene → rig → frames → motion
- **Image** (`/image`) — real Cloudflare renders, stored on Cloudinary
- **Status** (`/status`) — live spend against the daily cap, and which provider runs what
- **Pricing** (`/pricing`) — demo billing, labelled as such

Anything that came back as placeholder media carries a **Placeholder** badge — on the
result, in the library and in Explore. With `MOCK_KINDS=video` that is every clip, which
is honest: they are stand-ins, not renders.

---

## 5. Costs and limits

| Guard | Default | Where |
| --- | --- | --- |
| Whole-demo daily spend | `DAILY_CREDIT_CAP=5000` | refuses new renders past it |
| Renders at once, per visitor | 2 | `/status` |
| New guests per network per day | 8 | `/status` |
| Cloudflare Workers AI | ~170 images/day | free allowance, resets daily |

Credits are charged server-side before anything reaches a provider, and refunded exactly
once if the render fails, is refused, is cancelled or is abandoned.

---

## 6. Turning video on later

Drop `MOCK_KINDS` and fund a fal account. Video then routes to fal automatically, and the
Placeholder badges stop appearing on clips. Nothing else changes.
