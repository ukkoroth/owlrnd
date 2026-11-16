CREATE TYPE "public"."learner_type" AS ENUM('self_managed', 'parent_managed');--> statement-breakpoint
CREATE TYPE "public"."parent_link_kind" AS ENUM('manages', 'consents');--> statement-breakpoint
CREATE TYPE "public"."parent_link_status" AS ENUM('active', 'pending', 'declined', 'ended');--> statement-breakpoint
ALTER TYPE "public"."message_author" ADD VALUE 'learner';--> statement-breakpoint
CREATE TABLE "parent_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "parent_link_kind" NOT NULL,
	"status" "parent_link_status" DEFAULT 'active' NOT NULL,
	"verification_level" text,
	"given_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "codes" ALTER COLUMN "parent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "parent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "class_name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "student_id" uuid;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "claimed_by_student_id" uuid;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "ai_limit_usd" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "type" "learner_type" DEFAULT 'parent_managed' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "ai_limit_usd" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_links" ADD CONSTRAINT "parent_links_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "parent_links_unique" ON "parent_links" USING btree ("parent_id","student_id","kind");--> statement-breakpoint
CREATE INDEX "parent_links_student_idx" ON "parent_links" USING btree ("student_id");--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_claimed_by_student_id_students_id_fk" FOREIGN KEY ("claimed_by_student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_student_idx" ON "ai_usage" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "codes_student_idx" ON "codes" USING btree ("student_id","purpose","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "students_email_unique" ON "students" USING btree (lower("email"));--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_has_owner" CHECK ("codes"."parent_id" is not null or "codes"."student_id" is not null);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_parent_by_type" CHECK (("students"."type" = 'parent_managed') = ("students"."parent_id" is not null));--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_sign_in_by_type" CHECK (("students"."type" = 'parent_managed' and "students"."username" is not null) or ("students"."type" = 'self_managed' and "students"."email" is not null));--> statement-breakpoint
-- Every existing child is parent-managed: record the link (students.parent_id stays the fast path).
INSERT INTO "parent_links" ("parent_id", "student_id", "kind", "status", "given_at", "created_at")
SELECT "parent_id", "id", 'manages', 'active', "created_at", "created_at" FROM "students" WHERE "parent_id" IS NOT NULL
ON CONFLICT DO NOTHING;
