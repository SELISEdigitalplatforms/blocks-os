import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { describeInviteSuccess } from "./invite-people-utils";

describe("Invite people texts in German", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("shows German text once a German dictionary is registered", () => {
    useI18nStore
      .getState()
      .setRemote("de", "os.people", {
        "INVITE_PEOPLE_UTILS.INVITATION_SENT_TO_other":
          "Die Einladung wurde an {{count}} Personen gesendet",
      });
    useAppSettingsStore.getState().setSettings({ language: "de" });
    expect(describeInviteSuccess(["a@x.com", "b@x.com"], [])).toBe(
      "Die Einladung wurde an 2 Personen gesendet",
    );
  });
});
