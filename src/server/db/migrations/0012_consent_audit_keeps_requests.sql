ALTER TABLE "consent_requests" DROP CONSTRAINT "consent_requests_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "consent_requests" ALTER COLUMN "student_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;