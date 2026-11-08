import { describe, expect, it } from "vitest";
import type { IEmailConfig } from "@blocks-communication/mail/models/email";
import {
  ORGANIZATION_DEFAULT_CONFIGURATION,
  fromConfigurationValue,
  languageNameOf,
  outboundConfigurationGroups,
  resolveOrganizationDefault,
  toConfigurationValue,
} from "./template-organization";

const config = (c: Partial<IEmailConfig> & { itemId: string }) =>
  ({ name: c.itemId, isInbound: false, isDefault: false, ...c }) as IEmailConfig;

const configs = [
  config({ itemId: "def", isDefault: true }),
  config({ itemId: "gmail", organizationId: "default" }),
  config({ itemId: "inbox", isInbound: true }),
  config({ itemId: "acme-smtp", organizationId: "acme" }),
  config({ itemId: "acme-ses", organizationId: "acme", isOrganizationDefault: true }),
  config({ itemId: "acme-in", organizationId: "acme", isInbound: true }),
  config({ itemId: "globex", organizationId: "globex", isOrganizationDefault: true }),
];

describe("template configuration helpers", () => {
  it("maps Organization default to an empty configuration id and back (D9)", () => {
    expect(toConfigurationValue("")).toBe(ORGANIZATION_DEFAULT_CONFIGURATION);
    expect(toConfigurationValue(undefined)).toBe(ORGANIZATION_DEFAULT_CONFIGURATION);
    expect(toConfigurationValue("acme-smtp")).toBe("acme-smtp");
    expect(fromConfigurationValue(ORGANIZATION_DEFAULT_CONFIGURATION)).toBe("");
    expect(fromConfigurationValue("acme-smtp")).toBe("acme-smtp");
  });

  it("groups outbound configurations: the organization's, then the Default organization's (H8, H9)", () => {
    const acme = outboundConfigurationGroups(configs, "acme");
    expect(acme.own.map((c) => c.itemId)).toEqual(["acme-smtp", "acme-ses"]);
    expect(acme.shared.map((c) => c.itemId)).toEqual(["def", "gmail"]);

    const fallback = outboundConfigurationGroups(configs, "default");
    expect(fallback.own).toEqual([]);
    expect(fallback.shared.map((c) => c.itemId)).toEqual(["def", "gmail"]);
  });

  it("resolves Organization default to the organization's default, then the project default (H7)", () => {
    expect(resolveOrganizationDefault(configs, "acme")?.itemId).toBe("acme-ses");
    expect(resolveOrganizationDefault(configs, "initech")?.itemId).toBe("def");
    expect(resolveOrganizationDefault(configs, "default")?.itemId).toBe("def");
    expect(
      resolveOrganizationDefault(
        [
          config({
            itemId: "x",
            organizationId: "acme",
            isOrganizationDefault: true,
            isInbound: true,
          }),
        ],
        "acme",
      ),
    ).toBeUndefined();
  });

  it("names a language from the project's languages, else shows its code (D10)", () => {
    const languages = [{ languageCode: "en-US", languageName: "English" }];
    expect(languageNameOf("en-US", languages)).toBe("English");
    expect(languageNameOf("xx-YY", languages)).toBe("xx-YY");
    expect(languageNameOf("", languages)).toBe("-");
  });
});
