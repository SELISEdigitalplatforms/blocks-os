import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { describeSecretError } from "./secret-error";

describe("Secret errors in German", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows German text once a German dictionary is registered", () => {
    useI18nStore
      .getState()
      .setRemote("de", "os.secrets", {
        "SECRET_ERROR.YOU_DO_NOT_HAVE_PERMISSION": "Sie haben keine Berechtigung für diese Aktion.",
      });
    useAppSettingsStore.getState().setSettings({ language: "de" });
    expect(describeSecretError({ status: 403 }).message).toBe(
      "Sie haben keine Berechtigung für diese Aktion.",
    );
  });
});
