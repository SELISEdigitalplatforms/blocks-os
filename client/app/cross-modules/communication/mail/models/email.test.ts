import { describe, expect, it } from "vitest";
import {
  getAuthenticationOptions,
  getFixedTransport,
  getMailProvider,
  getMailProviderLabel,
  getMailProvidersFor,
  MAIL_PROVIDERS,
  MailAuthenticationType,
  MailSecurityMode,
  MailServiceProvider,
  MailStatus,
  usesPasswordAuthentication,
} from "./email";

describe("MailServiceProvider enum", () => {
  it("maps providers to their backend numeric values", () => {
    expect(MailServiceProvider.AmazonSes).toBe(0);
    expect(MailServiceProvider.Zoho).toBe(1);
    expect(MailServiceProvider.Office365Smtp).toBe(2);
    expect(MailServiceProvider.Gmail).toBe(3);
  });

  it("exposes a reverse lookup for numeric enum members", () => {
    expect(MailServiceProvider[0]).toBe("AmazonSes");
    expect(MailServiceProvider[1]).toBe("Zoho");
    expect(MailServiceProvider[2]).toBe("Office365Smtp");
  });
});

describe("MailAuthenticationType and MailSecurityMode enums", () => {
  it("keeps the serialization defaults at zero so old records land on the legacy path", () => {
    expect(MailAuthenticationType.Password).toBe(0);
    expect(MailSecurityMode.Legacy).toBe(0);
  });

  it("mirrors the backend values", () => {
    expect(MailAuthenticationType.OAuthClientCredentials).toBe(1);
    expect(MailSecurityMode.None).toBe(1);
    expect(MailSecurityMode.StartTls).toBe(2);
    expect(MailSecurityMode.SslOnConnect).toBe(3);
  });
});

describe("provider capability map", () => {
  it("has one entry per enum member", () => {
    const enumValues = Object.values(MailServiceProvider).filter(
      (value): value is MailServiceProvider => typeof value === "number",
    );
    expect(MAIL_PROVIDERS.map((p) => p.value).sort()).toEqual(enumValues.sort());
  });

  it("labels each provider for display", () => {
    // The enum reverse lookup would read "Office365Smtp"; the label is the contract.
    expect(getMailProviderLabel(MailServiceProvider.Office365Smtp)).toBe("Office 365");
    expect(getMailProviderLabel(MailServiceProvider.AmazonSes)).toBe("Amazon SES");
    expect(getMailProviderLabel(MailServiceProvider.Zoho)).toBe("Zoho");
    expect(getMailProviderLabel(MailServiceProvider.Gmail)).toBe("Gmail");
  });

  it("falls back to the numeric value for a provider this client does not know", () => {
    expect(getMailProviderLabel(99 as MailServiceProvider)).toBe("Provider 99");
  });

  it("offers each provider for the directions it supports", () => {
    expect(getMailProvidersFor(false).map((p) => p.value)).toEqual([
      MailServiceProvider.AmazonSes,
      MailServiceProvider.Zoho,
      MailServiceProvider.Office365Smtp,
      MailServiceProvider.Gmail,
    ]);
    expect(getMailProvidersFor(true).map((p) => p.value)).toEqual([
      MailServiceProvider.Zoho,
      MailServiceProvider.Office365Smtp,
      MailServiceProvider.Gmail,
    ]);
  });

  it("fixes the Office 365 transport per direction", () => {
    expect(getFixedTransport(MailServiceProvider.Office365Smtp, false)).toEqual({
      host: "smtp.office365.com",
      port: 587,
      securityMode: MailSecurityMode.StartTls,
      enableSSL: false,
    });
    expect(getFixedTransport(MailServiceProvider.Office365Smtp, true)).toEqual({
      host: "outlook.office365.com",
      port: 993,
      securityMode: MailSecurityMode.SslOnConnect,
      enableSSL: true,
    });
  });

  it("fixes the Gmail transport per direction", () => {
    expect(getFixedTransport(MailServiceProvider.Gmail, false)?.host).toBe("smtp.gmail.com");
    expect(getFixedTransport(MailServiceProvider.Gmail, true)?.host).toBe("imap.gmail.com");
  });

  it("leaves Amazon SES and Zoho without a fixed transport", () => {
    expect(getMailProvider(MailServiceProvider.AmazonSes)?.transport).toBeUndefined();
    expect(getMailProvider(MailServiceProvider.Zoho)?.transport).toBeUndefined();
  });

  it("offers Office 365 password sign-in for outbound only", () => {
    expect(getAuthenticationOptions(MailServiceProvider.Office365Smtp, false)).toEqual([
      MailAuthenticationType.OAuthClientCredentials,
      MailAuthenticationType.Password,
    ]);
    expect(getAuthenticationOptions(MailServiceProvider.Office365Smtp, true)).toEqual([
      MailAuthenticationType.OAuthClientCredentials,
    ]);
  });

  it("classifies authentication by provider default or the record's own type", () => {
    expect(usesPasswordAuthentication(MailServiceProvider.AmazonSes)).toBe(true);
    expect(usesPasswordAuthentication(MailServiceProvider.Zoho)).toBe(true);
    expect(usesPasswordAuthentication(MailServiceProvider.Gmail, true)).toBe(true);
    expect(usesPasswordAuthentication(MailServiceProvider.Office365Smtp)).toBe(false);
    expect(
      usesPasswordAuthentication(
        MailServiceProvider.Office365Smtp,
        false,
        MailAuthenticationType.Password,
      ),
    ).toBe(true);
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
