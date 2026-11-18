ALTER TYPE "public"."ai_purpose" ADD VALUE 'write_pool';--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "variant_of" uuid;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_variant_of_questions_id_fk" FOREIGN KEY ("variant_of") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;