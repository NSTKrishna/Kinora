ALTER TYPE "public"."provider_name" ADD VALUE 'cloudflare';--> statement-breakpoint
CREATE TABLE "generated_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"content_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generated_media" ADD CONSTRAINT "generated_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generated_media_user_created_idx" ON "generated_media" USING btree ("user_id","created_at" DESC NULLS LAST);