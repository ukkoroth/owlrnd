import "server-only";
import { fakeMarkAnswers, fakeTrackChat, fakeTrackUpdate, fakeWriteQuestions } from "./fake";
import { trackUpdateChat } from "./trackUpdate";
import { markAnswers } from "./markAnswers";
import { trackChat } from "./trackChat";
import { writeQuestions } from "./writeQuestions";

/** The AI calls the app makes. OWLRND_FAKE_AI=1 swaps in the deterministic fake (automated tests). */
export function ai() {
  return process.env.OWLRND_FAKE_AI === "1"
    ? { trackChat: fakeTrackChat, writeQuestions: fakeWriteQuestions, markAnswers: fakeMarkAnswers, trackUpdate: fakeTrackUpdate }
    : { trackChat, writeQuestions, markAnswers, trackUpdate: trackUpdateChat };
}

export { AiError } from "./client";
export type { TrackChatInput, ChatAttachmentInput } from "./trackChat";
export type { WriteQuestionsInput } from "./writeQuestions";
export type { AnswerToMark, MarkedAnswer } from "./markAnswers";
export type { TrackUpdateInput } from "./trackUpdate";
