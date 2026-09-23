/**
 * Presentation helpers shared by the mail list and the mail details page. Pure
 * functions, so the formatting rules can be tested without rendering.
 */

export interface IMailAddress {
  /** Display name, or the address itself when the header carries no name. */
  name: string;
  email: string;
}

const ANGLE_ADDRESS = /^\s*"?(.*?)"?\s*<([^>]+)>\s*$/;

/**
 * Splits an address list header ("Name" <a@x>, b@y) into its entries. Commas
 * inside a quoted display name do not split.
 */
export const splitAddresses = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angled = false;
  for (const ch of raw) {
    if (ch === '"') quoted = !quoted;
    if (ch === "<") angled = true;
    if (ch === ">") angled = false;
    if (ch === "," && !quoted && !angled) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

export const parseAddress = (raw: string | null | undefined): IMailAddress => {
  const value = (raw ?? "").trim();
  const match = ANGLE_ADDRESS.exec(value);
  if (match) {
    const email = match[2].trim();
    const name = match[1].trim();
    return { name: name || email, email };
  }
  return { name: value, email: value };
};

export const parseAddressList = (raw: string | null | undefined): IMailAddress[] =>
  splitAddresses(raw).map(parseAddress);

export const getInitials = ({ name, email }: IMailAddress): string => {
  const source = (name || email).replace(/@.*$/, "");
  const words = source.split(/[\s._-]+/).filter((word) => /[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (first + second).toUpperCase();
};

const AVATAR_TONES = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
] as const;

/** A stable colour per address, so the same sender always looks the same. */
export const getAvatarTone = (key: string): string => {
  let hash = 0;
  for (const ch of key.toLowerCase()) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
};

const pad = (value: number) => value.toString().padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Inbox-style date: the time for today, "23 Sep" for this year, and the full
 * date otherwise. The exact value goes in a tooltip via {@link formatMailDateLong}.
 */
export const formatMailDate = (value: string | Date, now: Date = new Date()): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

export const formatMailDateLong = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * A one-line preview from a plain-text or HTML body: markup, link targets and
 * markdown-ish decoration removed, whitespace collapsed.
 */
export const toPreview = (body: string | null | undefined, maxLength = 140): string => {
  if (!body) return "";
  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\]\((?:https?:|mailto:)[^)]*\)/gi, "]")
    .replace(/<?https?:\/\/\S+>?/gi, " ")
    .replace(/[[\]*_#>`]/g, " ")
    .replace(/-{3,}|={3,}/g, " ")
    .replace(/[ ​-‍­﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
};

export const looksLikeHtml = (body: string | null | undefined): boolean =>
  !!body && /<\/?(html|body|div|p|table|br|span|a|img|h[1-6])\b/i.test(body);

/**
 * The document the sandboxed frame renders. Links open in a new tab, and the
 * CSP forbids scripts, frames and form posts even if the sandbox were relaxed.
 */
export const buildMailFrameDocument = (html: string): string => {
  const head =
    '<meta charset="utf-8">' +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline' https:; font-src https: data:; form-action 'none'\">" +
    '<base target="_blank">' +
    "<style>body{margin:0;padding:16px;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;word-break:break-word}img{max-width:100%;height:auto}</style>";
  return `<!DOCTYPE html><html><head>${head}</head><body>${html}</body></html>`;
};
