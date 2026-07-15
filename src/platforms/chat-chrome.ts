/**
 * Decorative, non-data chat chrome shared by the message-style cards (Slack, Discord, WhatsApp,
 * Telegram). A timestamp and a first-person sender sell the "this is a sent message" framing;
 * OGee has no real sender identity or send time. Centralized so the fiction stays consistent
 * across cards in the side-by-side comparison view.
 */

function formatClockTime(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Clock time for chat chrome. Reads `now` when called (default: current time) so the
 * displayed value is not frozen at module import and tests can pin it with fake timers.
 */
export function getSentTime(now: Date = new Date()): string {
  return formatClockTime(now);
}

export function getDiscordSentTime(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear().toString().slice(-2);
  return `${month}/${day}/${year}, ${formatClockTime(now)}`;
}

export const SENDER = 'You';
export const SENDER_INITIAL = SENDER.charAt(0).toUpperCase();
