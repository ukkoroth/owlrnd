import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod";
import { rules } from "@/config/rules";
import { env } from "../env";
import { recordUsage } from "./usage";

let client: Anthropic | undefined;

/** Uses ANTHROPIC_API_KEY, or an `ant auth login` profile when the key is unset. */
export function anthropic(): Anthropic {
  // A request that hangs is cut off and tried once more, so a job can't sit "running" for half an hour per call.
  client ??= new Anthropic({ timeout: rules.jobs.aiCallTimeoutMinutes * 60_000, maxRetries: 1 });
  return client;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: "refusal" | "invalid_output" | "truncated",
  ) {
    super(message);
    this.name = "AiError";
  }
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type ContentBlock = BetaContentBlockParam;
export type Turn = { role: "user" | "assistant"; content: string | ContentBlock[] };

/** A textbook page photo for the track chat (AI §1). */
export function imageBlock(data: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"): ContentBlock {
  return { type: "image", source: { type: "base64", media_type: mediaType, data: data.toString("base64") } };
}

/** A PDF of textbook pages or a syllabus (AI §1). */
export function pdfBlock(data: Buffer, title?: string): ContentBlock {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") }, title };
}

/**
 * One structured call: the reply must match `schema`, and is validated before the app uses it (docs/07-ai.md).
 * Server-side refusal fallback is on, so a policy decline is retried on a fallback model in the same call.
 */
export async function generateStructured<S extends z.ZodType>(opts: {
  system: string;
  messages: Turn[];
  schema: S;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const response = await anthropic().beta.messages.parse({
    model: env().ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 16_000,
    system: opts.system,
    messages: opts.messages,
    thinking: { type: "adaptive" },
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });
  // Recorded before any checks below: refused or cut-off replies are billed too.
  await recordUsage(response.model, response.usage);

  if (response.stop_reason === "refusal") {
    throw new AiError(`Model declined the request (${response.stop_details?.category ?? "unknown"})`, "refusal");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AiError("Model output was cut off at max_tokens", "truncated");
  }
  if (response.parsed_output == null) {
    throw new AiError("Model output did not match the expected schema", "invalid_output");
  }
  return response.parsed_output as z.infer<S>;
}
