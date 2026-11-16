import "server-only";
import { holderForParent, type Holder } from "@/domain/accounts";
import { formatUsd } from "@/domain/allowance";
import { allowanceOf } from "./ai/usage";
import { getCurrentUser } from "./auth/current";
import { emailSender } from "./email";
import { env } from "./env";
import { loadLearner } from "./learners";

/** The signed-in user, if they hold their own account (a parent or a self-managed learner); never a child's parent. */
export async function currentHolder(): Promise<Holder | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role === "parent") return holderForParent(user.parent);
  if (user.student.type !== "self_managed") return null;
  return (await loadLearner(user.student.id))?.holder ?? null;
}

/**
 * Someone asked to buy a package (the AI allowance box, or /contact?topic=package). Emails the owner with what they
 * wrote and, when signed in, their account and allowance, so the owner can raise it with `npm run ai:allowance`.
 * False if the email couldn't be sent.
 */
export async function requestPackage(input: { name: string; email: string; message: string }): Promise<boolean> {
  const owner = env().OWNER_EMAIL;
  if (!owner) {
    console.warn(`[owlrnd contact] package request from ${input.email} (set OWNER_EMAIL to get this by email)`);
    return false;
  }
  const holder = await currentHolder();
  const account = holder
    ? await allowanceOf(holder).then((a) => [
        "",
        `Signed in as: ${holder.name} <${holder.email}> (${holder.kind === "parent" ? "parent" : "self-managed learner"})`,
        `AI allowance: ${formatUsd(Math.round(a.usedUsd * 100) / 100)} of ${formatUsd(a.limitUsd)} used`,
        `To raise it: npm run ai:allowance -- ${holder.email} <new limit in USD>`,
      ])
    : ["", "Not signed in."];
  try {
    await emailSender().send({
      to: owner,
      subject: `owlrnd package request: ${input.name}`,
      text: [`${input.name} <${input.email}> wants to buy a package.`, "", "Their message:", input.message, ...account].join("\n"),
    });
    return true;
  } catch (err) {
    console.error("[owlrnd contact] package request email failed", err);
    return false;
  }
}
