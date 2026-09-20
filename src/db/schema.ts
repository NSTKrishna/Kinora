import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const jobKind = pgEnum("job_kind", ["image", "video"]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "nsfw",
  "canceled",
]);
export const providerName = pgEnum("provider_name", ["mock", "fal", "cloudflare"]);
export const ledgerKind = pgEnum("ledger_kind", [
  "grant",
  "daily_grant",
  "charge",
  "refund",
  "purchase",
]);
export const assetKind = pgEnum("asset_kind", ["image", "video", "upload"]);
export const presetKind = pgEnum("preset_kind", ["effect", "camera"]);
export const cinemaStep = pgEnum("cinema_step", ["scene", "rig", "frames", "motion", "result"]);

/** Statuses that still need work from the queue. */
export const ACTIVE_JOB_STATUSES = ["queued", "running"] as const;

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Reserved for Clerk. Guests have none; filled in when an account is claimed. */
    clerkId: text("clerk_id").unique(),
    email: text("email"),
    name: text("name"),
    isGuest: boolean("is_guest").notNull().default(true),
    /** Salted hash, never a raw IP. Only used to rate-limit new guests. */
    signupIpHash: text("signup_ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_signup_ip_created_idx").on(table.signupIpHash, table.createdAt)],
);

/* ---------------------------------------------------------- credit ledger */

/**
 * Append-only. Balance is always SUM(delta) — never a cached column, so a
 * replay of the ledger and the live balance cannot drift apart.
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    kind: ledgerKind("kind").notNull(),
    jobId: uuid("job_id"),
    /** Every write carries one. This is what makes charges and refunds safe to retry. */
    idempotencyKey: text("idempotency_key").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("credit_ledger_idempotency_key_idx").on(table.idempotencyKey),
    index("credit_ledger_user_created_idx").on(table.userId, table.createdAt.desc()),
  ],
);

/* ------------------------------------------------------------------- jobs */

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: jobKind("kind").notNull(),
    modelId: text("model_id").notNull(),
    presetSlug: text("preset_slug"),
    status: jobStatus("status").notNull().default("queued"),
    input: jsonb("input")
      .notNull()
      .default(sql`'{}'::jsonb`),
    compiledPrompt: text("compiled_prompt").notNull(),
    provider: providerName("provider").notNull(),
    providerRequestId: text("provider_request_id").unique(),
    costCredits: integer("cost_credits").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_user_created_idx").on(table.userId, table.createdAt.desc()),
    // Pollers only ever ask for unfinished work; keep that index tiny.
    index("jobs_active_idx")
      .on(table.status, table.createdAt)
      .where(sql`${table.status} in ('queued', 'running')`),
  ],
);

/* ----------------------------------------------------------------- assets */

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    kind: assetKind("kind").notNull(),
    url: text("url").notNull(),
    thumbUrl: text("thumb_url"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    prompt: text("prompt"),
    modelId: text("model_id"),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("assets_user_created_idx").on(table.userId, table.createdAt.desc()),
    // The Explore feed reads this one, and it is a small slice of the table.
    index("assets_public_created_idx")
      .on(table.createdAt.desc())
      .where(sql`${table.isPublic}`),
  ],
);

/* ---------------------------------------------------------------- presets */

export const presets = pgTable("presets", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  kind: presetKind("kind").notNull(),
  /** Chip on /effects. Free text so a new grouping needs no migration. */
  category: text("category").notNull().default("camera"),
  description: text("description"),
  modelId: text("model_id").notNull(),
  promptTemplate: text("prompt_template").notNull(),
  defaultParams: jsonb("default_params")
    .notNull()
    .default(sql`'{}'::jsonb`),
  inputSlots: jsonb("input_slots")
    .notNull()
    .default(sql`'[]'::jsonb`),
  coverUrl: text("cover_url"),
  exampleUrl: text("example_url"),
  credits: integer("credits").notNull().default(1),
  sort: integer("sort").notNull().default(0),
});

/* ------------------------------------------------------------ media store */

/**
 * Bytes we hold ourselves.
 *
 * Most providers hand back a URL on their own CDN and there is nothing to
 * store. Cloudflare Workers AI returns the image inline as base64, so it has to
 * live somewhere — and with no `BLOB_READ_WRITE_TOKEN` configured there is no
 * object store to put it in. Postgres is not where images belong long-term,
 * but it works everywhere the app already runs, including Vercel's read-only
 * filesystem, and needs no extra configuration to get the demo working.
 *
 * Rows are immutable and served from `/api/media/[id]` with a far-future cache
 * header, so the database is read once per image per client.
 */
export const generatedMedia = pgTable(
  "generated_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    bytes: customType<{ data: Buffer; driverData: Buffer }>({
      dataType: () => "bytea",
    })("bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("generated_media_user_created_idx").on(table.userId, table.createdAt.desc())],
);

/* -------------------------------------------------------- cinema projects */

/**
 * One director's-panel sequence, saved as you go.
 *
 * The stepper keeps nothing in the tab: the panel state, which step you are on,
 * the frames job, the anchor you picked and the clip all live here, so a
 * refresh — or the same account on another device — resumes exactly where it
 * stopped. `spec` is a draft and may be incomplete; it is validated against the
 * runnable schema only when something is about to be rendered.
 */
export const cinemaProjects = pgTable(
  "cinema_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled sequence"),
    step: cinemaStep("step").notNull().default("scene"),
    spec: jsonb("spec")
      .notNull()
      .default(sql`'{}'::jsonb`),
    framesJobId: uuid("frames_job_id").references(() => jobs.id, { onDelete: "set null" }),
    anchorAssetId: uuid("anchor_asset_id").references(() => assets.id, { onDelete: "set null" }),
    videoJobId: uuid("video_job_id").references(() => jobs.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("cinema_projects_user_updated_idx").on(table.userId, table.updatedAt.desc())],
);

/* ------------------------------------------------------------- characters */

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    coverAssetId: uuid("cover_asset_id").references(() => assets.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("characters_user_created_idx").on(table.userId, table.createdAt.desc())],
);

/** Reference images only — no training in this build. */
export const characterAssets = pgTable(
  "character_assets",
  {
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.characterId, table.assetId] })],
);

/* ------------------------------------------------------------------ types */

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type CinemaProject = typeof cinemaProjects.$inferSelect;
export type Character = typeof characters.$inferSelect;
export type GeneratedMedia = typeof generatedMedia.$inferSelect;
export type LedgerEntry = typeof creditLedger.$inferSelect;
