import { render, screen } from "@testing-library/react";
import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";

import { BulkActionBar } from "../../api-settings/components/bulk-action-bar";
import { CAPTCHA_GENERATOR_TYPE } from "../../captcha/models/captcha";
import { toSessionCardViewModel } from "../security/mappers/session.mapper";
import { MFA_PROVIDER_DATA } from "../../mfa/utils/mfa-config";
import { NotifyUserCheckbox } from "./notify-user-checkbox";

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp console components non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows English by default and non-default language once the dictionary is loaded", () => {
    const { unmount } = render(
      <NotifyUserCheckbox checked={false} onCheckedChange={() => {}} description="d" />,
    );
    expect(screen.getByText("Notify user by email")).toBeTruthy();
    unmount();

    useI18nStore.getState().setRemote("xx", "os.idp.iam-ui", {
      "NOTIFY_USER_CHECKBOX.LABEL": "[xx] NOTIFY_USER_CHECKBOX.LABEL",
    });
    setLanguage("xx");
    render(<NotifyUserCheckbox checked={false} onCheckedChange={() => {}} description="d" />);
    expect(screen.getByText("[xx] NOTIFY_USER_CHECKBOX.LABEL")).toBeTruthy();
  });

  it("renders a component of the api-settings module in a non-default language", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.api-settings", {
      "BULK_ACTION_BAR.ENABLE_MFA": "[xx] BULK_ACTION_BAR.ENABLE_MFA",
    });
    setLanguage("xx");
    render(
      <BulkActionBar
        selectedCount={1}
        onEnableMfa={() => {}}
        onEnableCaptcha={() => {}}
        onClear={() => {}}
      />,
    );
    expect(screen.getByText("[xx] BULK_ACTION_BAR.ENABLE_MFA")).toBeTruthy();
  });

  it("translates constant tables and mappers when the language is read", () => {
    useI18nStore
      .getState()
      .setRemote("xx", "os.idp.mfa", { "MFA_CONFIG.EMAIL_LABEL": "[xx] MFA_CONFIG.EMAIL_LABEL" });
    useI18nStore.getState().setRemote("xx", "os.idp.captcha", {
      "CAPTCHA_MODEL.GENERATOR_HARD": "[xx] CAPTCHA_MODEL.GENERATOR_HARD",
    });
    useI18nStore.getState().setRemote("xx", "os.idp.security", {
      "SESSION_MAPPER.UNKNOWN_DEVICE": "[xx] SESSION_MAPPER.UNKNOWN_DEVICE",
      "SESSION_MAPPER.APPS_one": "{{count}} xx-app",
    });
    setLanguage("xx");

    expect(MFA_PROVIDER_DATA[0].label).toBe("[xx] MFA_CONFIG.EMAIL_LABEL");
    expect(CAPTCHA_GENERATOR_TYPE.HardCaptchaGenerator.label).toBe(
      "[xx] CAPTCHA_MODEL.GENERATOR_HARD",
    );
    const card = toSessionCardViewModel({
      sessionId: "s1",
      primaryDeviceName: null,
      primaryBrowser: "Chrome",
      primaryOperatingSystem: "macOS",
      primaryIpAddress: "192.0.2.1",
      lastActivityAt: "2025-01-01T00:00:00Z",
      absoluteExpiry: "2025-02-01T00:00:00Z",
      status: "Active",
      isCurrent: false,
      applicationCount: 1,
    } as unknown as Parameters<typeof toSessionCardViewModel>[0]);
    expect(card.deviceName).toBe("[xx] SESSION_MAPPER.UNKNOWN_DEVICE");
    expect(card.applicationSummary).toBe("1 xx-app");

    setLanguage("en");
    expect(MFA_PROVIDER_DATA[0].label).toBe("Email");
  });
});
