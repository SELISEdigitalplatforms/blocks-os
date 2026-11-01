import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccessPresetList } from "./components/schema-access-control/access-preset-list";
import { ACCESS_TIER_LABELS } from "./components/primitives";
import { RULE_OPERATORS } from "./constants/schema-access-control";
import { accessEffect } from "./utils/access-phrase";

const GERMAN = {
  "ACCESS_PRESET_LIST.SAMPLE_RULE_SET": "Beispiel-Regelsatz",
  "ACCESS_PRESET_LIST.START_EMPTY": "Mit einem leeren Regelsatz beginnen",
  "ACCESS_TIER_BADGE.TIER_CUSTOM": "Benutzerdefiniert",
  "SCHEMA_ACCESS_CONTROL.OPERATOR_EQUAL": "Gleich",
  "ACCESS_PHRASE.HEADING_NOBODY": "Niemand",
  "ACCESS_PHRASE.NOBODY_VIEW": "Niemand darf {{subject}} lesen.",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.gateway German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German text in a component, a constant table and a sentence", () => {
    useI18nStore.getState().setRemote("de", "os.idp.gateway", GERMAN);
    setLanguage("de");

    render(<AccessPresetList presets={[]} onApply={() => {}} onStartBlank={() => {}} />);
    expect(screen.getByText("Beispiel-Regelsatz")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Mit einem leeren Regelsatz beginnen" }),
    ).toBeTruthy();

    expect(ACCESS_TIER_LABELS.custom).toBe("Benutzerdefiniert");
    expect(RULE_OPERATORS[0].label).toBe("Gleich");

    const effect = accessEffect({ tier: "custom", tab: "view", subject: "Order", policies: [] });
    expect(effect.heading).toBe("Niemand");
    expect(effect.text).toBe("Niemand darf Order lesen.");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    expect(ACCESS_TIER_LABELS.custom).toBe("Custom");
  });
});
