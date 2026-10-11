import { z } from "zod";

/**
 * The server's hostname grammar (DomainManagementService.HostnameRegex): two or
 * more labels of letters, digits and inner hyphens, 1–63 characters each. The
 * server lower-cases before matching, so the client matches case-insensitively.
 */
const hostnameRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

const MAX_HOSTNAME_LENGTH = 253;

/**
 * True when the server would accept the value as a hostname. The length limit
 * is checked first, so oversized input is rejected without running the regex.
 */
export const isValidHostname = (value: string): boolean =>
  value.length <= MAX_HOSTNAME_LENGTH && hostnameRegex.test(value);

const INVALID_DOMAIN_MESSAGE = "Please enter a valid domain (e.g. example.com)";

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
    domain: z.string().min(1, "Domain is required").refine(isValidHostname, INVALID_DOMAIN_MESSAGE),
    cookieDomain: z
      .string()
      .min(1, "Cookie domain is required")
      .refine(isValidHostname, INVALID_DOMAIN_MESSAGE),
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
