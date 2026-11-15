import "server-only";
import { writeExamJob } from "../examWriter";
import { markExamJob } from "../marking";
import { deleteFilesJob } from "./files";
import { registerHandler } from "./worker";

/** Every background job type, registered once per server process (src/instrumentation.ts). */
export function registerAllHandlers() {
  registerHandler("write_exam", writeExamJob);
  registerHandler("mark_exam", (payload) => markExamJob(payload));
  registerHandler("delete_files", deleteFilesJob);
}
