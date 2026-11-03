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
    render(<PasswordStrengthChecker password="" confirmPassword="" onRequirementsMet={vi.fn()} />);
    expect(screen.getByText("Password Requirements")).toBeTruthy();
  });

  it("shows non-default language when a remote dictionary is registered and selected", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.auth", {
      "PASSWORD_STRENGTH_CHECKER.TITLE": "[xx] PASSWORD_STRENGTH_CHECKER.TITLE",
      "PASSWORD_STRENGTH_UTIL.LENGTH": "[xx] PASSWORD_STRENGTH_UTIL.LENGTH",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });

    render(<PasswordStrengthChecker password="" confirmPassword="" onRequirementsMet={vi.fn()} />);

    expect(screen.getByText("[xx] PASSWORD_STRENGTH_CHECKER.TITLE")).toBeTruthy();
    expect(screen.getByText("[xx] PASSWORD_STRENGTH_UTIL.LENGTH")).toBeTruthy();
  });
});
