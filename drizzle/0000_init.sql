CREATE TYPE "public"."asset_kind" AS ENUM('image', 'video', 'upload');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'nsfw', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('grant', 'daily_grant', 'charge', 'refund', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."preset_kind" AS ENUM('effect', 'camera');--> statement-breakpoint
CREATE TYPE "public"."provider_name" AS ENUM('mock', 'fal');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid,
	"kind" "asset_kind" NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"prompt" text,
	"model_id" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_assets" (
	"character_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	CONSTRAINT "character_assets_character_id_asset_id_pk" PRIMARY KEY("character_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"cover_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"job_id" uuid,
	"idempotency_key" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "job_kind" NOT NULL,
	"model_id" text NOT NULL,
	"preset_slug" text,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"compiled_prompt" text NOT NULL,
	"provider" "provider_name" NOT NULL,
	"provider_request_id" text,
	"cost_credits" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "jobs_provider_request_id_unique" UNIQUE("provider_request_id")
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" "preset_kind" NOT NULL,
	"model_id" text NOT NULL,
	"prompt_template" text NOT NULL,
	"default_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cover_url" text,
	"example_url" text,
	"credits" integer DEFAULT 1 NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text,
	"email" text,
	"name" text,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assets" ADD CONSTRAINT "character_assets_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_assets" ADD CONSTRAINT "character_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_user_created_idx" ON "assets" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "assets_public_created_idx" ON "assets" USING btree ("created_at" DESC NULLS LAST) WHERE "assets"."is_public";--> statement-breakpoint
CREATE INDEX "characters_user_created_idx" ON "characters" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idempotency_key_idx" ON "credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_user_created_idx" ON "jobs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "jobs_active_idx" ON "jobs" USING btree ("status","created_at") WHERE "jobs"."status" in ('queued', 'running');