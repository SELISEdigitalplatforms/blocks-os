import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { describeInviteSuccess } from "./invite-people-utils";

describe("Invite people texts in a non-default language", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows remote text once a remote dictionary is registered", () => {
    useI18nStore.getState().setRemote("xx", "os.people", {
      "INVITE_PEOPLE_UTILS.INVITATION_SENT_TO_other":
        "Die Einladung wurde an {{count}} Personen gesendet",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });
    expect(describeInviteSuccess(["a@x.com", "b@x.com"], [])).toBe(
      "Die Einladung wurde an 2 Personen gesendet",
    );
  });
});
