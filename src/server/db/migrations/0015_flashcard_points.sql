ALTER TABLE "points_events" ALTER COLUMN "exam_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "points_events" ADD COLUMN "flashcard_session_id" uuid;--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_flashcard_session_id_flashcard_sessions_id_fk" FOREIGN KEY ("flashcard_session_id") REFERENCES "public"."flashcard_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "points_events_flashcard_session_idx" ON "points_events" USING btree ("flashcard_session_id");--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_source" CHECK (("points_events"."exam_id" is null) <> ("points_events"."flashcard_session_id" is null));