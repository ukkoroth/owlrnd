ALTER TYPE "public"."ai_purpose" ADD VALUE 'draw_visuals';--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "visual" jsonb;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "visual_drawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "visual" jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "visual_drawn_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "questions_visual_todo_idx" ON "questions" USING btree ("track_id") WHERE visual_drawn_at is null;--> statement-breakpoint
-- Pictures (docs/plan-wrong-answer-visuals.md): rows written before this are skipped (epoch), so the backlog isn't
-- drawn all at once. An old pool question or card is drawn when an exam or a practice session picks it.
UPDATE "questions" SET "visual_drawn_at" = 'epoch' WHERE NOT EXISTS (
  SELECT 1 FROM "exam_questions" eq JOIN "exams" e ON e.id = eq.exam_id
  WHERE eq.question_id = "questions".id AND e.status IN ('ready', 'in_progress')
);--> statement-breakpoint
UPDATE "flashcards" SET "visual_drawn_at" = 'epoch';
