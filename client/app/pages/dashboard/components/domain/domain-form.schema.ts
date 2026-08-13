import { z } from "zod";

const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

/**
 * Enough of the public suffix list to recognise the common multi-label TLDs.
 * A cookie domain of "co.uk" would put the derived API host on a name nobody
 * owns, so those have to be rejected the same way a bare "com" is.
 */
const SECOND_LEVEL_SUFFIX_LABELS = [
  "ac",
  "biz",
  "co",
  "com",
  "edu",
  "gob",
  "gov",
  "info",
  "mil",
  "ne",
  "net",
  "or",
  "org",
  "res",
  "sch",
];

const isPublicSuffix = (value: string): boolean => {
  const labels = value.split(".");
  if (labels.length === 1) return true;
  // Only ccTLDs hand out second-level suffixes, and every one is two letters.
  return labels.length === 2 && labels[1].length === 2 && SECOND_LEVEL_SUFFIX_LABELS.includes(labels[0]);
};

/**
 * A cookie domain has to be the domain itself or one of its parents — the same
 * rule browsers apply to Set-Cookie — and it has to be a registrable name.
 * Mirrors the server-side check so the form fails fast instead of on submit.
 */
export const isCookieDomainValidFor = (domain: string, cookieDomain: string): boolean => {
  // A leading dot is the old cookie-domain spelling (".example.com") and still
  // turns up in stored records, so it must not fail the check.
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^\./, "")
      .toLowerCase();

  const host = normalize(domain);
  const cookie = normalize(cookieDomain);

  if (!host || !cookie) return false;
  if (isPublicSuffix(cookie)) return false;

  return host === cookie || host.endsWith(`.${cookie}`);
};

export const domainFormSchema = z
  .object({
    domain: z
      .string()
      .min(1, "Domain is required")
      .regex(domainRegex, "Please enter a valid domain (e.g. example.com)"),
    cookieDomain: z
      .string()
      .min(1, "Cookie domain is required")
      .regex(domainRegex, "Please enter a valid domain (e.g. example.com)"),
  })
  .refine(({ domain, cookieDomain }) => isCookieDomainValidFor(domain, cookieDomain), {
    path: ["cookieDomain"],
    message: "Cookie domain must be the domain itself or one of its parent domains",
  });

export type DomainFormSchema = z.infer<typeof domainFormSchema>;

export const domainFormDefaultValues: DomainFormSchema = {
  domain: "",
  cookieDomain: "",
};
