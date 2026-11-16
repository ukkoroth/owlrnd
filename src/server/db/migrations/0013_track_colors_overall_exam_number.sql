ALTER TABLE "exams" ADD COLUMN "overall_number" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "color_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exams_student_overall_unique" ON "exams" USING btree ("student_id","overall_number");--> statement-breakpoint
-- Existing tracks: a different colour per track for each learner, in the order they were created.
UPDATE "tracks" t SET "color_index" = x.n % 8 FROM (
  SELECT "id", (row_number() OVER (PARTITION BY "student_id" ORDER BY "created_at", "id") - 1) AS n FROM "tracks"
) x WHERE x."id" = t."id";
--> statement-breakpoint
-- Existing started exams: number them per learner in the order they were started.
UPDATE "exams" e SET "overall_number" = x.n FROM (
  SELECT "id", row_number() OVER (PARTITION BY "student_id" ORDER BY "started_at", "number", "id") AS n FROM "exams" WHERE "started_at" IS NOT NULL
) x WHERE x."id" = e."id";
