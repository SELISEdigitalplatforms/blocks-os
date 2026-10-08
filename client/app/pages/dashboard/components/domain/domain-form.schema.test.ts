import { afterEach, describe, expect, it, vi } from "vitest";
import { domainFormSchema, isCookieDomainValidFor, isValidHostname } from "./domain-form.schema";

describe("isCookieDomainValidFor", () => {
  it.each([
    // The domain itself, or any parent of it, is the customer's to claim.
    ["app.example.com", "example.com", true],
    ["app.example.com", "app.example.com", true],
    ["deep.app.example.com", "app.example.com", true],
    ["example.com", "example.com", true],
    ["https://app.example.com", "example.com", true],
    // The old leading-dot spelling still turns up in stored records.
    ["app.example.com", ".example.com", true],
    // A domain they are not under is not — this is what stops one project
    // claiming another's cookie domain, and its shared API host with it.
    ["app.evil.com", "example.com", false],
    // Suffix matching must respect label boundaries, or "ample.com" passes.
    ["app.notexample.com", "example.com", false],
    // A bare public suffix would put the derived API host on a name that
    // belongs to nobody in this system.
    ["app.example.com", "com", false],
    ["app.example.co.uk", "co.uk", false],
    ["app.example.com", "", false],
    ["", "example.com", false],
  ])("%s with cookie domain %s → %s", (domain, cookieDomain, expected) => {
    expect(isCookieDomainValidFor(domain, cookieDomain)).toBe(expected);
  });
});

describe("domainFormSchema", () => {
  it("accepts a domain under its cookie domain", () => {
    const result = domainFormSchema.safeParse({
      domain: "app.example.com",
      cookieDomain: "example.com",
    });
    expect(result.success).toBe(true);
  });

  it("reports a mismatched cookie domain on the cookieDomain field", () => {
    const result = domainFormSchema.safeParse({
      domain: "app.example.com",
      cookieDomain: "someone-else.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["cookieDomain"]);
    }
  });
});

const INVALID_DOMAIN = "Please enter a valid domain (e.g. example.com)";
const label63 = "a".repeat(63);
// 4 × 63-character labels joined by dots: exactly 255 characters, so trimming
// one label to 61 lands on 253 and to 62 on 254.
const longHost = (lastLabelLength: number) =>
  [label63, label63, label63, "a".repeat(lastLabelLength)].join(".");

describe("isValidHostname", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    // Hyphens and digits are allowed in every label, not just the first.
    ["abc.se-ll.com", true],
    ["app.web3.io", true],
    ["my-app.my-company.co.uk", true],
    ["ABC.Se-LL.com", true],
    ["example.xn--p1ai", true],
    [`${label63}.com`, true],
    [longHost(61), true],
    // Hosts that were already valid keep working.
    ["app.example.com", true],
    ["dblddc-eiwep.dev.slsblx.com", true],
    // Hyphens may not start or end a label.
    ["abc.-sell.com", false],
    ["-abc.com", false],
    ["abc.sell-.com", false],
    // Every host needs at least two non-empty labels.
    ["abc", false],
    ["abc..com", false],
    [".abc.com", false],
    ["abc.com.", false],
    // Only letters, digits, hyphens and dots, typed without a scheme.
    ["abc.se_ll.com", false],
    ["abc.com ", false],
    ["abc com", false],
    ["abc.com/path", false],
    ["abc.com:443", false],
    ["https://abc.com", false],
    [`${"a".repeat(64)}.com`, false],
    [longHost(62), false],
  ])("%s → %s", (value, expected) => {
    expect(isValidHostname(value)).toBe(expected);
  });

  it("rejects oversized input on length alone, without running the regex", () => {
    const test = vi.spyOn(RegExp.prototype, "test");

    expect(isValidHostname("a-".repeat(50000) + "!")).toBe(false);
    expect(test).not.toHaveBeenCalled();
  });

  // Each row records the server's outcome for a host that its normalisation
  // (trim, scheme and trailing-slash stripping, lower-casing) leaves unchanged
  // apart from case, so client and server judge the same string.
  it.each([
    ["abc.se-ll.com", true],
    ["web3.app.io", true],
    ["xn--80ak6aa92e.com", true],
    ["192.168.0.1", true],
    ["a.b", true],
    ["abc-.com", false],
    ["abc.-com", false],
    ["abc", false],
    ["abc..com", false],
    ["ab_c.com", false],
  ])("matches the server outcome for %s (%s)", (host, serverAccepts) => {
    expect(isValidHostname(host.toLowerCase())).toBe(serverAccepts);
  });
});

describe("domainFormSchema field messages", () => {
  const issuesFor = (domain: string, cookieDomain: string) => {
    const result = domainFormSchema.safeParse({ domain, cookieDomain });
    return result.success ? [] : result.error.issues;
  };

  it.each([
    ["abc.se-ll.com", "se-ll.com"],
    ["app.web3.io", "web3.io"],
    ["my-app.my-company.co.uk", "my-company.co.uk"],
    ["ABC.Se-LL.com", "se-ll.com"],
    ["example.xn--p1ai", "example.xn--p1ai"],
    [`${label63}.com`, `${label63}.com`],
  ])("accepts %s with cookie domain %s", (domain, cookieDomain) => {
    expect(issuesFor(domain, cookieDomain)).toEqual([]);
  });

  it.each([
    ["abc.-sell.com", "-sell.com"],
    ["abc.sell-.com", "sell-.com"],
    ["abc", "abc"],
    ["abc..com", ".com"],
    ["abc.se_ll.com", "se_ll.com"],
    [`${"a".repeat(64)}.com`, `${"a".repeat(64)}.com`],
    [longHost(62), longHost(62)],
  ])("reports %s as an invalid domain", (domain, cookieDomain) => {
    const domainIssue = issuesFor(domain, cookieDomain).find((i) => i.path[0] === "domain");
    expect(domainIssue?.message).toBe(INVALID_DOMAIN);
  });

  it.each([
    ["abc.se-ll.com", "other-site.com"],
    ["app.my-site.co.uk", "co.uk"],
  ])("keeps the cookie-domain error for %s with %s", (domain, cookieDomain) => {
    expect(issuesFor(domain, cookieDomain)).toEqual([
      expect.objectContaining({
        path: ["cookieDomain"],
        message: "Cookie domain must be the domain itself or one of its parent domains",
      }),
    ]);
  });

  it("reports empty fields as required before anything else", () => {
    const issues = issuesFor("", "");
    expect(issues.find((i) => i.path[0] === "domain")?.message).toBe("Domain is required");
    expect(issues.find((i) => i.path[0] === "cookieDomain")?.message).toBe(
      "Cookie domain is required",
    );
  });
});
