// Reads codes from the Mailpit inbox (docker compose) so tests can complete sign-in like a parent would.
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

type Summary = { ID: string; Subject: string; To: { Address: string }[]; Created: string };

/** Newest 6-digit code emailed to `to`, waiting up to `timeoutMs` for it to arrive. */
export async function latestCode(to: string, { after = new Date(0), timeoutMs = 10_000 } = {}): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=1`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    const msg = messages[0];
    if (msg && new Date(msg.Created) > after) {
      const code = msg.Subject.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code emailed to ${to} within ${timeoutMs} ms`);
}

export async function clearInbox() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
}

/** How many emails `to` has received so far. */
export async function inboxCount(to: string): Promise<number> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}&limit=1`);
  const body = (await res.json()) as { messages_count: number };
  return body.messages_count;
}

/** Waits for email number `previousCount + 1` to `to` and returns its code. Avoids comparing clocks. */
export async function nextCode(to: string, previousCount: number, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await inboxCount(to)) > previousCount) return latestCode(to);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No new email to ${to} within ${timeoutMs} ms`);
}
