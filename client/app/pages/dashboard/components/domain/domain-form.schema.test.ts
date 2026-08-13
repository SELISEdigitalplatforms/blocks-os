import { describe, expect, it } from "vitest";
import { domainFormSchema, isCookieDomainValidFor } from "./domain-form.schema";

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
