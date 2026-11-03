import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityChooseState } from "./activity/activity-empty-states";
import { signupLinkConfigurationFormSchema } from "./configuration-form-schema";
import { maxRedemptionsLabel } from "./max-redemptions";

const REMOTE = {
  "ACTIVITY_EMPTY_STATES.CHOOSE": "[xx] ACTIVITY_EMPTY_STATES.CHOOSE",
  "CONFIGURATION_FORM_SCHEMA.NAME_REQUIRED": "[xx] CONFIGURATION_FORM_SCHEMA.NAME_REQUIRED",
  "MAX_REDEMPTIONS.UNLIMITED": "[xx] MAX_REDEMPTIONS.UNLIMITED",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.signup-links non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows non-default language in a component, a label helper and a zod message", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.signup-links", REMOTE);
    setLanguage("xx");

    render(<ActivityChooseState />);
    expect(screen.getByText("[xx] ACTIVITY_EMPTY_STATES.CHOOSE")).toBeTruthy();
    expect(maxRedemptionsLabel(0)).toBe("[xx] MAX_REDEMPTIONS.UNLIMITED");

    const result = signupLinkConfigurationFormSchema.safeParse({ name: "" });
    const nameIssue = result.success
      ? undefined
      : result.error.issues.find((issue) => issue.path[0] === "name");
    expect(nameIssue?.message).toBe("[xx] CONFIGURATION_FORM_SCHEMA.NAME_REQUIRED");
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    expect(maxRedemptionsLabel(0)).toBe("Unlimited");
  });
});
