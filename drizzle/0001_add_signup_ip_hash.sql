ALTER TABLE "users" ADD COLUMN "signup_ip_hash" text;--> statement-breakpoint
CREATE INDEX "users_signup_ip_created_idx" ON "users" USING btree ("signup_ip_hash","created_at");