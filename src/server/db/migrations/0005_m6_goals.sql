CREATE TYPE "public"."message_kind" AS ENUM('create', 'extend');--> statement-breakpoint
ALTER TABLE "track_messages" ADD COLUMN "kind" "message_kind" DEFAULT 'create' NOT NULL;--> statement-breakpoint
ALTER TABLE "track_messages" ADD COLUMN "update" jsonb;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "goal_since_exam" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "goal_reached_at" timestamp with time zone;