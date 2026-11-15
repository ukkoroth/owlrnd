import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { markedAnswersSchema, trackChatSchema, trackUpdateSchema, writtenExamSchema } from "./schemas";

// Real Claude outputs recorded by `npm run ai:smoke`. If a schema change would break parsing them, this fails.
const dir = "tests/fixtures-files/ai-samples";
const sample = (name: string) => (existsSync(`${dir}/${name}`) ? JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) : null);

describe("recorded Claude outputs still parse", () => {
  for (const name of ["trackChat-turn1.json", "trackChat-turn2.json"]) {
    it.skipIf(!sample(name))(name, () => {
      expect(trackChatSchema.safeParse(sample(name)).success).toBe(true);
    });
  }
  for (const name of ["trackUpdate-turn1.json", "trackUpdate-turn2.json"]) {
    it.skipIf(!sample(name))(name, () => {
      expect(trackUpdateSchema.safeParse(sample(name)).success).toBe(true);
    });
  }
  it.skipIf(!sample("markAnswers.json"))("markAnswers.json", () => {
    expect(markedAnswersSchema.safeParse(sample("markAnswers.json")).success).toBe(true);
  });
  it.skipIf(!sample("writeQuestions.json"))("writeQuestions.json", () => {
    expect(writtenExamSchema.safeParse(sample("writeQuestions.json")).success).toBe(true);
  });
});
