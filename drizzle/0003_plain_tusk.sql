CREATE TYPE "public"."cinema_step" AS ENUM('scene', 'rig', 'frames', 'motion', 'result');--> statement-breakpoint
CREATE TABLE "cinema_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled sequence' NOT NULL,
	"step" "cinema_step" DEFAULT 'scene' NOT NULL,
	"spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"frames_job_id" uuid,
	"anchor_asset_id" uuid,
	"video_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cinema_projects" ADD CONSTRAINT "cinema_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_projects" ADD CONSTRAINT "cinema_projects_frames_job_id_jobs_id_fk" FOREIGN KEY ("frames_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_projects" ADD CONSTRAINT "cinema_projects_anchor_asset_id_assets_id_fk" FOREIGN KEY ("anchor_asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinema_projects" ADD CONSTRAINT "cinema_projects_video_job_id_jobs_id_fk" FOREIGN KEY ("video_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cinema_projects_user_updated_idx" ON "cinema_projects" USING btree ("user_id","updated_at" DESC NULLS LAST);