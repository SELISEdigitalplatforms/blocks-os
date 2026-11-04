import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { describeSecretError } from "./secret-error";

describe("Secret errors in a non-default language", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows remote text once a remote dictionary is registered", () => {
    useI18nStore.getState().setRemote("xx", "os.secrets", {
      "SECRET_ERROR.YOU_DO_NOT_HAVE_PERMISSION": "[xx] SECRET_ERROR.YOU_DO_NOT_HAVE_PERMISSION",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });
    expect(describeSecretError({ status: 403 }).message).toBe(
      "[xx] SECRET_ERROR.YOU_DO_NOT_HAVE_PERMISSION",
    );
  });
});
