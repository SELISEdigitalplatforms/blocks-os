import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { createDomainFormSchema } from "./domain-form.schema";

describe("Domain form messages in a non-default language", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows the non-default language 'required' message once a remote dictionary is registered", () => {
    useI18nStore.getState().setRemote("xx", "os.dashboard", {
      "DOMAIN_FORM_SCHEMA.DOMAIN_IS_REQUIRED": "[xx] DOMAIN_FORM_SCHEMA.DOMAIN_IS_REQUIRED",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });

    const result = createDomainFormSchema().safeParse({ domain: "", cookieDomain: "" });

    expect(JSON.stringify(result.error?.issues ?? [])).toContain(
      "[xx] DOMAIN_FORM_SCHEMA.DOMAIN_IS_REQUIRED",
    );
  });
});
