import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityChooseState } from "./activity/activity-empty-states";
import { signupLinkConfigurationFormSchema } from "./configuration-form-schema";
import { maxRedemptionsLabel } from "./max-redemptions";

const GERMAN = {
  "ACTIVITY_EMPTY_STATES.CHOOSE": "Wählen Sie eine Konfiguration.",
  "CONFIGURATION_FORM_SCHEMA.NAME_REQUIRED": "Name ist erforderlich",
  "MAX_REDEMPTIONS.UNLIMITED": "Unbegrenzt",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.signup-links German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German in a component, a label helper and a zod message", () => {
    useI18nStore.getState().setRemote("de", "os.idp.signup-links", GERMAN);
    setLanguage("de");

    render(<ActivityChooseState />);
    expect(screen.getByText("Wählen Sie eine Konfiguration.")).toBeTruthy();
    expect(maxRedemptionsLabel(0)).toBe("Unbegrenzt");

    const result = signupLinkConfigurationFormSchema.safeParse({ name: "" });
    const nameIssue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === "name");
    expect(nameIssue?.message).toBe("Name ist erforderlich");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    expect(maxRedemptionsLabel(0)).toBe("Unlimited");
  });
});
