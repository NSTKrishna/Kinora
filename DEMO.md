# Kinora — demo script

A 10-minute walkthrough. Stage directions in _italics_, the words to say in plain text.
Cut §4 or §6 first if you are short on time; never cut §1 or §7.

Before you start: open `/` , `/effects/levitation`, `/cinema` and `/status` in four tabs,
and have this repo open in a fifth. Check `/api/health` reads
`"image": "cloudflare", "video": "mock", "uploads": "cloudinary"`.

---

## 1. What it is — 45 seconds

> Kinora is an AI creative studio — you give it a prompt or a photo and it gives you back
> a still or a short film clip. I built it in a day, on the brief "something in the
> Higgsfield category, but your own product, your own identity, nothing copied."
>
> One thing up front so it doesn't look like I'm hiding it: **image generation is real and
> live, video is deliberately mocked.** Stills run on Cloudflare Workers AI, which is free
> within a daily allowance. Video models bill per second of output, and I wasn't going to
> put a live invoice behind a demo link. The whole video pipeline is real — queue, polling,
> refunds, storage — it just ends at a stand-in clip, and the UI says so on every one.
>
> I'd rather show you a system that's honest about what it is than one that looks
> impressive until you ask.

_Say this before they notice the Placeholder badges, not after._

---

## 2. Explore — the front door — 1 minute

_Open `/`._

> No sign-up wall. You're already a user — there's a signed guest cookie minted in edge
> middleware, and the database row is created lazily the first time you actually do
> something. Sign-in exists as a stub but nothing needs it, because a creative tool that
> asks for your email before showing you anything loses.
>
> The feed is real published work plus licensed reference footage so it's never empty on a
> cold database. The credited tiles are stock, labelled as stock — that mattered to me,
> because the brief said own identity and own generated content, and quietly passing
> someone else's cinematography off as my model's output would break that.

_Hover a tile, point at **Recreate**._

> Every tile carries its prompt forward. That's the loop — see something, take its recipe,
> make your own.

---

## 3. Effects — the viral loop — 2 minutes

_Open `/effects`, pick **Levitation**._

> Eight one-click presets. Each one is a database row, not a hardcoded branch — a title, an
> example clip, a model, a prompt template with placeholders, default params, and a cost.
> Adding a ninth effect is an insert, not a deploy.

_Upload a photo. While it's running:_

> That photo went straight from the browser to Cloudinary — it never passed through my
> server. That's deliberate: a serverless function on Vercel caps its request body at about
> four and a half megabytes, so a normal phone photo posted through my own API would work
> perfectly on my laptop and fail in production. The server only signs the upload and
> records the result.
>
> And it checks. The signature embeds the user's own id in the storage path, and the record
> step rebuilds the URL and verifies it before saving. You can't claim someone else's
> upload by pasting its URL — I tested that specifically.

_When the clip lands, point at the **Placeholder** badge._

> There's the honesty I mentioned. That badge follows the media everywhere — the result,
> your library, the public feed.

_Open **How this was made**._

> And the exact compiled prompt is right there. No black box — if you don't like the
> result, you can see precisely what was sent.

---

## 4. Cinema — the depth — 2 minutes

_Open `/cinema`._

> This is the part I'm proudest of. It's a director's panel: describe the scene, then build
> the rig — five camera bodies, six lens families, five focal lengths, three apertures —
> then pick from ten motion presets. Each option carries a fragment of prompt language, and
> they compile into one shot description.

_Step through Scene → Rig → Frames → Motion._

> Two things worth knowing. First, **the compiler is a pure function** — data in, string
> out, no database, no network. So the interesting logic is unit-tested properly instead of
> being verified by clicking around.
>
> Second, prompts have a length ceiling, and rather than hardcode "scene can be 400
> characters" I derive it: the compiler computes the longest rig any combination of options
> could possibly produce and subtracts it. So the cap is correct by construction. If I add
> a wordier lens tomorrow, the scene limit adjusts itself and it is not possible to build a
> combination that overflows.

_Refresh the page mid-flow._

> And it survives a refresh. Each step persists as you go.

---

## 5. Real generation — 1.5 minutes

_Open `/image`, run a prompt. This one is genuinely live._

> This is Cloudflare Workers AI — a real model, a real render, roughly 170 a day free.
> Cloudflare only returns 1024 squares, so the requested aspect is centre-cropped from one
> and the stored dimensions describe what you actually got, not what you asked for.
>
> The result goes to Cloudinary rather than into Postgres. Storing megabytes of WebP in a
> free-tier database is a bad idea that works fine right until it doesn't.

_Point at the credit counter._

> Credits were taken before anything reached the provider — never on the client. If that
> render had failed you'd have them back, exactly once.

---

## 6. Under the hood — 2 minutes

_Switch to the editor. Have `ARCHITECTURE.md` open — it has the diagrams._

> Fifteen thousand lines, seventeen API routes, a hundred and fifteen tests. Three things
> I'd point at.

**The ledger.** _Open `src/lib/credits.ts`._

> Credits are an append-only ledger. There's no balance column — the balance is
> `SUM(delta)`, always derived, so it cannot drift from its own history. Every write carries
> an idempotency key: `job:<id>:charge`, `job:<id>:refund`. Charging twice is impossible
> because the second insert collides.

**The state machine.** _Open `src/lib/jobs.ts`, find `transition`._

> Four different things can finish a job: the browser polling, a provider webhook, the user
> cancelling, or the sweep that cleans up abandoned work. All four race. So every status
> change goes through one function that claims it with
> `UPDATE … WHERE status IN ('queued','running') RETURNING` — if you didn't get a row back,
> someone else already finished it and you do nothing. That's what makes the refund
> exactly-once rather than probably-once.

**Degrading honestly.** _Open `src/lib/providers/index.ts`._

> Providers sit behind one interface with three implementations, and there's a hybrid mode:
> if a provider can't serve us at all — exhausted balance, rejected key, rate limit, outage
> — you get a badged placeholder instead of an error.
>
> But only for *those* failures. A content refusal or a malformed request still fails, hard.
> Answering "I won't generate that" with an unrelated video would be a lie, and hiding a
> real bug costs more than showing it. Unknown errors fail closed, on purpose.

---

## 7. The bug worth telling them about — 1 minute

_This is your strongest moment. Don't skip it._

> When I first pointed it at a real Cloudflare account, every still failed with a 404 —
> "Application black-forest-labs not found." The cause was a fallback I'd written earlier:
> if Cloudflare has no credentials, route stills to fal instead. It routed correctly, but
> it kept sending Cloudflare's model path to fal, which has no such model. That fallback had
> never worked, and I had a passing test for it — the test asserted the *routing* and never
> checked that the provider could resolve the id.
>
> What found it was the hybrid mode refusing to mask it. A 404 is a bug, not a billing
> problem, so it failed loudly instead of quietly serving a placeholder. If I'd made the
> fallback catch everything, that would still be broken and I wouldn't know.
>
> I fixed it, and the new test asserts the thing that actually matters.

_If they seem interested, add:_

> I also mutation-test the guards — I invert the classifier and confirm the tests go red. A
> test that passes either way isn't testing anything.

---

## 8. Closing — 30 seconds

> Built in a day, deployed on free tiers: Cloudflare Workers AI for models, Cloudinary for
> media, Neon for Postgres, Vercel for hosting. No card on any of them.
>
> What I cut, and would do next: real sign-in, character training — right now characters are
> an identity stub, not a fine-tune — and turning video on, which is one environment variable
> and a funded account.

---

## If something breaks mid-demo

**Placeholder appears where you expected a real render.** Say it out loud — it's the
feature working. "Cloudflare's daily allowance has run out, so it degraded instead of
erroring. That's the behaviour I built." Then show `/status`, which counts it.

**Everything is slow.** First request after idle wakes the Neon instance. Hit `/api/health`
in a spare tab before you start.

**A render hangs.** Anything stuck over 15 minutes is failed and refunded by the next
request that comes through — no cron, no worker. Say that; it's a design point.

**The whole thing is down.** Run it locally: `pnpm dev`. Same database, same providers.

---

## Questions they will ask

**"Why not just use the Vercel AI SDK / a framework for this?"**
> The provider layer is four methods — submit, status, result, cancel. Three adapters
> implement it. A framework would have given me abstraction I'd have had to fight when fal
> and Cloudflare turned out to behave completely differently: fal is an async queue,
> Cloudflare is synchronous and returns base64 inline.

**"How do you stop someone draining your credits?"**
> Cost is computed server-side from the model registry — the client sends params, never a
> price. On top of that: two concurrent renders per visitor, eight new guests per network
> per day, and a whole-demo daily cap that refuses new work rather than overspending.

**"What happens if the provider webhook fires twice?"**
> Nothing. Same claim-the-transition pattern — the second one gets no row back and returns.

**"Is the mocked video hiding that it doesn't work?"**
> The opposite — the pipeline is identical, and the only difference is which adapter runs.
> Flip one environment variable and it's live. Every clip is labelled so you always know
> which you're looking at.

**"What would you fix first with more time?"**
> Two things. `/api/media/[id]` ignores the public flag — anyone with the UUID gets the
> bytes, which is unguessable-URL security and I'd rather it were explicit. And two routes
> don't have the error handling every other route has. Both are in my own audit notes.

_That last answer lands well. Knowing your own weak spots reads better than claiming none._
