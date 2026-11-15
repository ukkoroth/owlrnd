import { rules } from "@/config/rules";
import type { FormState } from "@/lib/form";
import type { VerifyResult } from "@/server/auth/codes";

export const sendLimitMessage = `We've already sent ${rules.accounts.code.maxSendsPerHour} codes in the last hour. Use the code in the latest email, or try again later.`;

/** Wording for screen 5f and the other code screens. */
export function codeMessage(r: Exclude<VerifyResult, { result: "ok" }>): FormState {
  switch (r.result) {
    case "malformed":
      return { error: "Enter the 6-digit code from the email.", codeInvalid: true };
    case "wrong":
      return {
        error: `That code is not right. Check the latest email and try again. ${r.triesLeft} ${r.triesLeft === 1 ? "try" : "tries"} left.`,
        codeInvalid: true,
      };
    case "locked":
      return r.newCodeSent
        ? { error: "That code was wrong 3 times, so it no longer works. We sent a new code. Check the latest email.", codeInvalid: true }
        : { error: `That code was wrong 3 times, so it no longer works. ${sendLimitMessage}`, codeInvalid: true };
    case "expired":
      return { error: "That code has expired. Send a new code and use the one in the latest email.", codeInvalid: true };
    case "used":
    case "invalidated":
    case "no_code":
      return { error: "That code no longer works. Use the code in the latest email, or send a new code.", codeInvalid: true };
  }
}
