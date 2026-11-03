import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { createDomainFormSchema } from "./domain-form.schema";

describe("Domain form messages in German", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows the German 'required' message once a German dictionary is registered", () => {
    useI18nStore.getState().setRemote("de", "os.dashboard", {
      "DOMAIN_FORM_SCHEMA.DOMAIN_IS_REQUIRED": "Domain ist erforderlich",
    });
    useAppSettingsStore.getState().setSettings({ language: "de" });

    const result = createDomainFormSchema().safeParse({ domain: "", cookieDomain: "" });

    expect(JSON.stringify(result.error?.issues ?? [])).toContain("Domain ist erforderlich");
  });
});
