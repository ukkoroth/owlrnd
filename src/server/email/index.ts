import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { ServerClient } from "postmark";
import { env } from "../env";

export type CodePurpose = "verify_email" | "sign_in" | "reset_password" | "change_email" | "parent_consent";

export type CodeEmail = {
  to: string;
  /** The account holder's name: the parent, or a self-managed learner. */
  parentName: string;
  /** The code is for a self-managed learner's own account (no parent involved). */
  selfManaged?: boolean;
  purpose: CodePurpose;
  code: string;
  /** Set when a student asked for the code (sign-in or reset for a student). */
  studentName?: string;
  ttlMinutes: number;
};

/** Any other plain-text email (invitations, owner notices). */
export type PlainEmail = { to: string; subject: string; text: string };

export interface EmailSender {
  sendCode(email: CodeEmail): Promise<void>;
  send(email: PlainEmail): Promise<void>;
}

export function renderCodeEmail(e: CodeEmail): { subject: string; text: string } {
  const who = e.studentName ? `${e.studentName} is` : "You are";
  const what: Record<CodePurpose, { subject: string; line: string }> = {
    verify_email: { subject: "Confirm your email for owlrnd", line: "Use this code to confirm your email address." },
    sign_in: { subject: "Your owlrnd sign-in code", line: `${who} signing in to owlrnd.` },
    reset_password: { subject: "Your owlrnd password reset code", line: `${who} resetting a password on owlrnd.` },
    change_email: { subject: "Confirm your new email for owlrnd", line: "Use this code to confirm your new email address." },
    parent_consent: { subject: "Your owlrnd consent code", line: `Use this code to confirm it's you and answer ${e.studentName ?? "the learner"}'s request.` },
  };
  const { subject, line } = what[e.purpose];
  const text = [
    `Hi ${e.parentName},`,
    "",
    line,
    "",
    `    ${e.code}`,
    "",
    `The code works once and expires in ${e.ttlMinutes} minutes.`,
    e.selfManaged ? "If this wasn't you, you can ignore this email." : "If this wasn't you or your child, you can ignore this email.",
    "",
    "owlrnd",
  ].join("\n");
  return { subject: `${subject}: ${e.code}`, text };
}

class ConsoleSender implements EmailSender {
  async sendCode(e: CodeEmail) {
    const { subject } = renderCodeEmail(e);
    console.info(`[owlrnd email] to=${e.to} purpose=${e.purpose} code=${e.code} subject="${subject}"`);
  }

  async send(e: PlainEmail) {
    console.info(`[owlrnd email] to=${e.to} subject="${e.subject}"\n${e.text}`);
  }
}

class PostmarkSender implements EmailSender {
  constructor(
    private client: ServerClient,
    private from: string,
  ) {}

  async sendCode(e: CodeEmail) {
    const { subject, text } = renderCodeEmail(e);
    await this.send({ to: e.to, subject, text });
  }

  async send(e: PlainEmail) {
    await this.client.sendEmail({ From: this.from, To: e.to, Subject: e.subject, TextBody: e.text, MessageStream: "outbound" });
  }
}

/** Any SMTP server; in dev this is Mailpit from docker compose. */
class SmtpSender implements EmailSender {
  constructor(
    private transport: Transporter,
    private from: string,
  ) {}

  async sendCode(e: CodeEmail) {
    const { subject, text } = renderCodeEmail(e);
    await this.send({ to: e.to, subject, text });
  }

  async send(e: PlainEmail) {
    await this.transport.sendMail({ from: this.from, to: e.to, subject: e.subject, text: e.text });
  }
}

let sender: EmailSender | undefined;

export function emailSender(): EmailSender {
  if (!sender) {
    const e = env();
    switch (e.EMAIL_TRANSPORT) {
      case "postmark":
        sender = new PostmarkSender(new ServerClient(e.POSTMARK_SERVER_TOKEN!), e.EMAIL_FROM);
        break;
      case "smtp":
        sender = new SmtpSender(nodemailer.createTransport(e.SMTP_URL), e.EMAIL_FROM);
        break;
      default:
        sender = new ConsoleSender();
    }
  }
  return sender;
}
