import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsUnsavedBadge } from "./components/settings-unsaved-badge";
import { formatMinutes } from "./utils/format-config";
import { schemaExposure } from "../data-access/explorer/explorer-utils";
import { formatDefaultSummary } from "../data-access/rules/default-value.util";

const REMOTE_SETTINGS = {
  "SETTINGS_UNSAVED_BADGE.UNSAVED": "[xx] SETTINGS_UNSAVED_BADGE.UNSAVED",
  "FORMAT_CONFIG.MINUTES_one": "{{count}} xx-minute",
  "FORMAT_CONFIG.MINUTES_other": "{{count}} xx-minutes",
};
const REMOTE_EXPLORER = { "EXPLORER_UTILS.PUBLIC_READ": "[xx] EXPLORER_UTILS.PUBLIC_READ" };
const REMOTE_RULES = {
  "DEFAULT_VALUE_UTIL.SUMMARY_NOW": "[xx] DEFAULT_VALUE_UTIL.SUMMARY_NOW",
  "DEFAULT_VALUE_UTIL.SUMMARY_DAYS_other": "{{sign}} {{count}} xx-days",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.settings, explorer and rules non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows non-default language in a component, a plural and the data-access helpers", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.settings", REMOTE_SETTINGS);
    useI18nStore.getState().setRemote("xx", "os.idp.explorer", REMOTE_EXPLORER);
    useI18nStore.getState().setRemote("xx", "os.idp.rules", REMOTE_RULES);
    setLanguage("xx");

    render(<SettingsUnsavedBadge />);
    expect(screen.getByText("[xx] SETTINGS_UNSAVED_BADGE.UNSAVED")).toBeTruthy();
    expect(formatMinutes(1)).toBe("1 xx-minute");
    expect(formatMinutes(30)).toBe("30 xx-minutes");
    expect(
      schemaExposure({
        readAccessLevel: 2,
        writeAccessLevel: 3,
        editAccessLevel: 3,
        deleteAccessLevel: 3,
      })?.reason,
    ).toBe("[xx] EXPLORER_UTILS.PUBLIC_READ");
    expect(
      formatDefaultSummary({
        kind: "Now",
        offset: { days: 365, hours: 0, minutes: 0, seconds: 0 },
      }),
    ).toBe("[xx] DEFAULT_VALUE_UTIL.SUMMARY_NOW + 365 xx-days");
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    expect(formatMinutes(30)).toBe("30 minutes");
    expect(formatMinutes(1)).toBe("1 minute");
  });
});
