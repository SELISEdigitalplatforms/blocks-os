import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AccessPresetList } from "./components/schema-access-control/access-preset-list";
import { ACCESS_TIER_LABELS } from "./components/primitives";
import { RULE_OPERATORS } from "./constants/schema-access-control";
import { accessEffect } from "./utils/access-phrase";

const REMOTE = {
  "ACCESS_PRESET_LIST.SAMPLE_RULE_SET": "[xx] ACCESS_PRESET_LIST.SAMPLE_RULE_SET",
  "ACCESS_PRESET_LIST.START_EMPTY": "[xx] ACCESS_PRESET_LIST.START_EMPTY",
  "ACCESS_TIER_BADGE.TIER_CUSTOM": "[xx] ACCESS_TIER_BADGE.TIER_CUSTOM",
  "SCHEMA_ACCESS_CONTROL.OPERATOR_EQUAL": "[xx] SCHEMA_ACCESS_CONTROL.OPERATOR_EQUAL",
  "ACCESS_PHRASE.HEADING_NOBODY": "[xx] ACCESS_PHRASE.HEADING_NOBODY",
  "ACCESS_PHRASE.NOBODY_VIEW": "[xx] ACCESS_PHRASE.NOBODY_VIEW {{subject}}",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.gateway non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows remote text in a component, a constant table and a sentence", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.gateway", REMOTE);
    setLanguage("xx");

    render(<AccessPresetList presets={[]} onApply={() => {}} onStartBlank={() => {}} />);
    expect(screen.getByText("[xx] ACCESS_PRESET_LIST.SAMPLE_RULE_SET")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "[xx] ACCESS_PRESET_LIST.START_EMPTY" }),
    ).toBeTruthy();

    expect(ACCESS_TIER_LABELS.custom).toBe("[xx] ACCESS_TIER_BADGE.TIER_CUSTOM");
    expect(RULE_OPERATORS[0].label).toBe("[xx] SCHEMA_ACCESS_CONTROL.OPERATOR_EQUAL");

    const effect = accessEffect({ tier: "custom", tab: "view", subject: "Order", policies: [] });
    expect(effect.heading).toBe("[xx] ACCESS_PHRASE.HEADING_NOBODY");
    expect(effect.text).toBe("[xx] ACCESS_PHRASE.NOBODY_VIEW Order");
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    expect(ACCESS_TIER_LABELS.custom).toBe("Custom");
  });
});
