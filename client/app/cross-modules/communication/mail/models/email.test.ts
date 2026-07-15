import { describe, expect, it } from "vitest";
import { MailServiceProvider, MailStatus } from "./email";

describe("MailServiceProvider enum", () => {
  it("maps providers to their backend numeric values", () => {
    expect(MailServiceProvider.AmazonSes).toBe(0);
    expect(MailServiceProvider.Zoho).toBe(1);
  });

  it("exposes a reverse lookup for numeric enum members", () => {
    expect(MailServiceProvider[0]).toBe("AmazonSes");
    expect(MailServiceProvider[1]).toBe("Zoho");
  });
});

describe("MailStatus enum", () => {
  it("uses string values that mirror the mail pipeline states", () => {
    expect(MailStatus.Sent).toBe("Sent");
    expect(MailStatus.Delivered).toBe("Delivered");
    expect(MailStatus.Bounced).toBe("Bounced");
    expect(MailStatus.Complained).toBe("Complained");
    expect(MailStatus.Rejected).toBe("Rejected");
    expect(MailStatus.Received).toBe("Received");
  });

  it("contains exactly the six known statuses", () => {
    expect(Object.values(MailStatus)).toHaveLength(6);
  });
});
