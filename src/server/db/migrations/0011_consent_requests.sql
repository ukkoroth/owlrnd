CREATE TYPE "public"."consent_event_kind" AS ENUM('requested', 'link_resent', 'email_changed', 'reminder_sent', 'code_sent', 'code_wrong', 'code_verified', 'agreed', 'declined', 'paused_no_answer');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('pending', 'agreed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"student_id" uuid,
	"kind" "consent_event_kind" NOT NULL,
	"detail" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"parent_name" text NOT NULL,
	"parent_email" text NOT NULL,
	"token_hash" text NOT NULL,
	"link_expires_at" timestamp with time zone NOT NULL,
	"status" "consent_status" DEFAULT 'pending' NOT NULL,
	"verification_level" text,
	"progress_view" boolean DEFAULT false NOT NULL,
	"policy_version" text,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"code_tries_left" integer DEFAULT 0 NOT NULL,
	"code_used_at" timestamp with time zone,
	"reminded_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consent_requests_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_request_id_consent_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."consent_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_events_request_idx" ON "consent_events" USING btree ("request_id","at");--> statement-breakpoint
CREATE INDEX "consent_events_student_idx" ON "consent_events" USING btree ("student_id","at");--> statement-breakpoint
CREATE INDEX "consent_requests_student_idx" ON "consent_requests" USING btree ("student_id","created_at");