ALTER TABLE "parents" ADD COLUMN "consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "consent_version" text;