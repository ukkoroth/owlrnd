CREATE TYPE "public"."marked_by" AS ENUM('rule', 'ai');--> statement-breakpoint
CREATE TYPE "public"."points_kind" AS ENUM('finish', 'correct', 'improvement', 'topic_strong', 'perfect', 'streak');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('correct', 'missed');--> statement-breakpoint
CREATE TABLE "marks" (
	"exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"marks_awarded" integer NOT NULL,
	"verdict" "verdict" NOT NULL,
	"reason" text,
	"marked_by" "marked_by" NOT NULL,
	CONSTRAINT "marks_exam_id_question_id_pk" PRIMARY KEY("exam_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "points_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"kind" "points_kind" NOT NULL,
	"points" integer NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"exam_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marks" ADD CONSTRAINT "marks_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_events" ADD CONSTRAINT "points_events_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_results" ADD CONSTRAINT "topic_results_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_results" ADD CONSTRAINT "topic_results_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_results" ADD CONSTRAINT "topic_results_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_results" ADD CONSTRAINT "topic_results_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_events_student_idx" ON "points_events" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "topic_results_topic_idx" ON "topic_results" USING btree ("student_id","topic_id","answered_at");