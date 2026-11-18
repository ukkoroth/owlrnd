ALTER TABLE "points_events" DROP CONSTRAINT "points_events_source";--> statement-breakpoint
ALTER TABLE "points_events" DROP CONSTRAINT "points_events_exam_id_exams_id_fk";
--> statement-breakpoint
ALTER TABLE "points_events" DROP CONSTRAINT "points_events_flashcard_session_id_flashcard_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "archived_from" "track_status";--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_flashcard_session_id_flashcard_sessions_id_fk" FOREIGN KEY ("flashcard_session_id") REFERENCES "public"."flashcard_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_source" CHECK ("points_events"."exam_id" is null or "points_events"."flashcard_session_id" is null);--> statement-breakpoint
-- Tracks archived before 0017 could only be archived from goal reached.
UPDATE "tracks" SET "archived_from" = 'goal_reached' WHERE "status" = 'archived';
