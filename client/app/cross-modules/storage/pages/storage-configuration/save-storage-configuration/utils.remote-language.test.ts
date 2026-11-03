import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { buildStorageConfigurationFormSchema } from "./utils";

describe("Storage configuration messages in a non-default language", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows the non-default language 'required' message once a remote dictionary is registered", () => {
    useI18nStore.getState().setRemote("xx", "os.storage", {
      "UTILS.NAME_IS_REQUIRED": "[xx] UTILS.NAME_IS_REQUIRED",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });

    const result = buildStorageConfigurationFormSchema(false).safeParse({ name: "" });

    expect(JSON.stringify(result.error?.issues ?? [])).toContain("[xx] UTILS.NAME_IS_REQUIRED");
  });
});
