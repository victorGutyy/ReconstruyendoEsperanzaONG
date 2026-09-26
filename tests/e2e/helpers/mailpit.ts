// Mailpit is the fake inbox of the local Supabase stack (http://127.0.0.1:54324).
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type MailpitSearch = { messages: { ID: string }[] };
type MailpitMessage = { HTML: string; Subject: string };

/** Waits for the latest e-mail sent to `to` and returns it. */
export async function waitForEmail(to: string, timeoutMs = 15_000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = (await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    ).then((response) => response.json())) as MailpitSearch;
    const latest = search.messages[0];
    if (latest) {
      return (await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`).then((response) =>
        response.json(),
      )) as MailpitMessage;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no e-mail arrived for ${to}`);
}

/** Number of e-mails sent to `to` (0 when none). */
export async function countEmails(to: string): Promise<number> {
  const search = (await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
  ).then((response) => response.json())) as MailpitSearch;
  return search.messages.length;
}

/** The recovery link from the e-mail HTML (href is HTML-escaped). */
export function extractRecoveryLink(html: string): string {
  const match = html.match(/href="([^"]*token_hash=[^"]*)"/);
  if (!match?.[1]) throw new Error("no recovery link in the e-mail");
  return match[1].replaceAll("&amp;", "&");
}
