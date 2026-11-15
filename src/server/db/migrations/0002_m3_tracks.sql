CREATE TYPE "public"."exam_status" AS ENUM('ready', 'in_progress', 'submitted', 'marking', 'marked');--> statement-breakpoint
CREATE TYPE "public"."message_author" AS ENUM('parent', 'ai');--> statement-breakpoint
CREATE TYPE "public"."next_exam_state" AS ENUM('none', 'writing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('multiple_choice', 'short');--> statement-breakpoint
CREATE TYPE "public"."track_status" AS ENUM('draft', 'active', 'paused', 'goal_reached', 'archived');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"track_message_id" uuid,
	"file_key" text NOT NULL,
	"media_type" text NOT NULL,
	"original_name" text NOT NULL,
	"label" text,
	"extracted_text" text,
	"unreadable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "exam_questions_exam_id_position_pk" PRIMARY KEY("exam_id","position")
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "exam_status" DEFAULT 'ready' NOT NULL,
	"score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"marked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"type" "question_type" NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_option" integer,
	"expected_answer" text,
	"marks" integer DEFAULT 1 NOT NULL,
	"difficulty" integer NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"added_in_message_id" uuid,
	"revision_only" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"author" "message_author" NOT NULL,
	"text" text NOT NULL,
	"preview" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"name" text,
	"status" "track_status" DEFAULT 'draft' NOT NULL,
	"test_date" date,
	"test_label" text,
	"goal_threshold" integer,
	"goal_run_length" integer,
	"goal_progress" integer DEFAULT 0 NOT NULL,
	"focus_notes" text,
	"next_exam" "next_exam_state" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_track_message_id_track_messages_id_fk" FOREIGN KEY ("track_message_id") REFERENCES "public"."track_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_messages" ADD CONSTRAINT "track_messages_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_track_message_idx" ON "attachments" USING btree ("track_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exams_track_number_unique" ON "exams" USING btree ("track_id","number");--> statement-breakpoint
CREATE INDEX "exams_student_idx" ON "exams" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "questions_track_idx" ON "questions" USING btree ("track_id","topic_id");--> statement-breakpoint
CREATE INDEX "topics_track_idx" ON "topics" USING btree ("track_id","position");--> statement-breakpoint
CREATE INDEX "track_messages_track_idx" ON "track_messages" USING btree ("track_id","created_at");--> statement-breakpoint
CREATE INDEX "tracks_student_idx" ON "tracks" USING btree ("student_id","status");