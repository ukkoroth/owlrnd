CREATE TYPE "public"."flashcard_result" AS ENUM('got_it', 'not_yet');--> statement-breakpoint
CREATE TYPE "public"."flashcard_source" AS ENUM('material', 'missed_question');--> statement-breakpoint
ALTER TYPE "public"."ai_purpose" ADD VALUE 'write_flashcards';--> statement-breakpoint
ALTER TYPE "public"."points_kind" ADD VALUE 'flashcards';--> statement-breakpoint
CREATE TABLE "flashcard_reviews" (
	"session_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"result" "flashcard_result" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flashcard_reviews_session_id_card_id_pk" PRIMARY KEY("session_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "flashcard_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"cards_seen" integer DEFAULT 0 NOT NULL,
	"got_it" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"front" text NOT NULL,
	"answer" text NOT NULL,
	"explanation" text NOT NULL,
	"source" "flashcard_source" DEFAULT 'material' NOT NULL,
	"source_question_id" uuid,
	"box" integer DEFAULT 1 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_session_id_flashcard_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."flashcard_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_card_id_flashcards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_sessions" ADD CONSTRAINT "flashcard_sessions_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_source_question_id_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flashcard_sessions_student_idx" ON "flashcard_sessions" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE INDEX "flashcard_sessions_track_idx" ON "flashcard_sessions" USING btree ("track_id","started_at");--> statement-breakpoint
CREATE INDEX "flashcards_track_due_idx" ON "flashcards" USING btree ("track_id","due_at");--> statement-breakpoint
CREATE INDEX "flashcards_topic_idx" ON "flashcards" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flashcards_source_question_unique" ON "flashcards" USING btree ("track_id","source_question_id");