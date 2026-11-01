import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { buildStorageConfigurationFormSchema } from "./utils";

describe("Storage configuration messages in German", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows the German 'required' message once a German dictionary is registered", () => {
    useI18nStore.getState().setRemote("de", "os.storage", {
      "UTILS.NAME_IS_REQUIRED": "Name ist erforderlich",
    });
    useAppSettingsStore.getState().setSettings({ language: "de" });

    const result = buildStorageConfigurationFormSchema(false).safeParse({ name: "" });

    expect(JSON.stringify(result.error?.issues ?? [])).toContain("Name ist erforderlich");
  });
});
