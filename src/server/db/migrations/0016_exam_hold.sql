CREATE TYPE "public"."exam_hold" AS ENUM('allowance', 'daily_limit', 'budget', 'consent');--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "next_exam_hold" "exam_hold";