CREATE TYPE "public"."question_mode" AS ENUM('pool', 'fresh');--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "question_mode" "question_mode" DEFAULT 'pool' NOT NULL;