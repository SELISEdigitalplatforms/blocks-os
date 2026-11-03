import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsUnsavedBadge } from "./components/settings-unsaved-badge";
import { formatMinutes } from "./utils/format-config";
import { schemaExposure } from "../data-access/explorer/explorer-utils";
import { formatDefaultSummary } from "../data-access/rules/default-value.util";

const GERMAN_SETTINGS = {
  "SETTINGS_UNSAVED_BADGE.UNSAVED": "Nicht gespeichert",
  "FORMAT_CONFIG.MINUTES_one": "{{count}} Minute",
  "FORMAT_CONFIG.MINUTES_other": "{{count}} Minuten",
};
const GERMAN_EXPLORER = { "EXPLORER_UTILS.PUBLIC_READ": "Jeder kann dieses Schema lesen" };
const GERMAN_RULES = {
  "DEFAULT_VALUE_UTIL.SUMMARY_NOW": "Jetzt",
  "DEFAULT_VALUE_UTIL.SUMMARY_DAYS_other": "{{sign}} {{count}} Tage",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.settings, explorer and rules German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German in a component, a plural and the data-access helpers", () => {
    useI18nStore.getState().setRemote("de", "os.idp.settings", GERMAN_SETTINGS);
    useI18nStore.getState().setRemote("de", "os.idp.explorer", GERMAN_EXPLORER);
    useI18nStore.getState().setRemote("de", "os.idp.rules", GERMAN_RULES);
    setLanguage("de");

    render(<SettingsUnsavedBadge />);
    expect(screen.getByText("Nicht gespeichert")).toBeTruthy();
    expect(formatMinutes(1)).toBe("1 Minute");
    expect(formatMinutes(30)).toBe("30 Minuten");
    expect(
      schemaExposure({
        readAccessLevel: 2,
        writeAccessLevel: 3,
        editAccessLevel: 3,
        deleteAccessLevel: 3,
      })?.reason,
    ).toBe("Jeder kann dieses Schema lesen");
    expect(
      formatDefaultSummary({
        kind: "Now",
        offset: { days: 365, hours: 0, minutes: 0, seconds: 0 },
      }),
    ).toBe("Jetzt + 365 Tage");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    expect(formatMinutes(30)).toBe("30 minutes");
    expect(formatMinutes(1)).toBe("1 minute");
  });
});
