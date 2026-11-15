/**
 * Closed beta: see who asked for access and send invitations.
 *
 *   npm run access -- list               everyone who asked, oldest first
 *   npm run access -- list --pending     only those not invited yet
 *   npm run invite -- a@x.com b@y.com    email a sign-up link to each address
 *   npm run invite -- --pending          invite everyone still waiting
 *
 * Emails go through the app's email settings in .env.local (Mailpit in development). APP_URL sets the link's address.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

// Loaded after .env.local: the database module reads its settings as soon as it is imported.
const { invite, listAccessRequests } = await import("@/server/access");

const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

async function list(pendingOnly: boolean) {
  const rows = await listAccessRequests(pendingOnly ? "pending" : undefined);
  if (!rows.length) return console.log(pendingOnly ? "Nobody is waiting." : "No access requests yet.");
  for (const r of rows) {
    console.log(`${date(r.createdAt)}  ${r.status.padEnd(7)}  ${r.name} <${r.email}>${r.invitedAt ? `  invited ${date(r.invitedAt)}` : ""}`);
    if (r.note) console.log(`            ${r.note.replace(/\s+/g, " ")}`);
  }
  console.log(`\n${rows.length} request${rows.length === 1 ? "" : "s"}.`);
}

async function sendInvites(args: string[]) {
  const emails = args.includes("--pending") ? (await listAccessRequests("pending")).map((r) => r.email) : args.filter((a) => !a.startsWith("--"));
  if (!emails.length) {
    console.log(args.includes("--pending") ? "Nobody is waiting." : "Give one or more email addresses, or --pending.");
    return;
  }
  for (const email of emails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error(`Skipped "${email}": not an email address.`);
      process.exitCode = 1;
      continue;
    }
    const { link, expiresAt } = await invite(email);
    console.log(`Invited ${email} (link expires ${date(expiresAt)})\n  ${link}`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "list") await list(args.includes("--pending"));
  else if (command === "invite") await sendInvites(args);
  else {
    console.log("Usage: npm run access -- list [--pending]\n       npm run invite -- <email> [<email> …] | --pending");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  // The database pool would keep the process alive.
  .finally(() => process.exit(process.exitCode ?? 0));
