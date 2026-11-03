import { render, screen } from "@testing-library/react";
import { useI18nStore } from "@seliseblocks/genesis-os/i18n";
import { useAppSettingsStore } from "@seliseblocks/genesis-os/store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordStrengthChecker } from "./password-strength-checker";

describe("PasswordStrengthChecker i18n", () => {
  afterEach(() => {
    useAppSettingsStore.getState().setSettings({ language: "en" });
  });

  it("shows English by default", () => {
    render(
      <PasswordStrengthChecker password="" confirmPassword="" onRequirementsMet={vi.fn()} />,
    );
    expect(screen.getByText("Password Requirements")).toBeTruthy();
  });

  it("shows German when a German dictionary is registered and selected", () => {
    useI18nStore.getState().setRemote("de", "os.idp.auth", {
      "PASSWORD_STRENGTH_CHECKER.TITLE": "Passwortanforderungen",
      "PASSWORD_STRENGTH_UTIL.LENGTH": "Zwischen 8 und 30 Zeichen",
    });
    useAppSettingsStore.getState().setSettings({ language: "de" });

    render(
      <PasswordStrengthChecker password="" confirmPassword="" onRequirementsMet={vi.fn()} />,
    );

    expect(screen.getByText("Passwortanforderungen")).toBeTruthy();
    expect(screen.getByText("Zwischen 8 und 30 Zeichen")).toBeTruthy();
  });
});
