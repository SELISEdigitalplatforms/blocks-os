import { render, screen } from "@testing-library/react";
import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";

import { BulkActionBar } from "../../api-settings/components/bulk-action-bar";
import { CAPTCHA_GENERATOR_TYPE } from "../../captcha/models/captcha";
import { toSessionCardViewModel } from "../security/mappers/session.mapper";
import { MFA_PROVIDER_DATA } from "../../mfa/utils/mfa-config";
import { NotifyUserCheckbox } from "./notify-user-checkbox";

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp console components German", () => {
  afterEach(() => setLanguage("en"));

  it("shows English by default and German once the dictionary is loaded", () => {
    const { unmount } = render(
      <NotifyUserCheckbox checked={false} onCheckedChange={() => {}} description="d" />,
    );
    expect(screen.getByText("Notify user by email")).toBeTruthy();
    unmount();

    useI18nStore.getState().setRemote("de", "os.idp.iam-ui", {
      "NOTIFY_USER_CHECKBOX.LABEL": "Benutzer per E-Mail benachrichtigen",
    });
    setLanguage("de");
    render(<NotifyUserCheckbox checked={false} onCheckedChange={() => {}} description="d" />);
    expect(screen.getByText("Benutzer per E-Mail benachrichtigen")).toBeTruthy();
  });

  it("renders a component of the api-settings module in German", () => {
    useI18nStore.getState().setRemote("de", "os.idp.api-settings", {
      "BULK_ACTION_BAR.ENABLE_MFA": "MFA aktivieren",
    });
    setLanguage("de");
    render(
      <BulkActionBar selectedCount={1} onEnableMfa={() => {}} onEnableCaptcha={() => {}} onClear={() => {}} />,
    );
    expect(screen.getByText("MFA aktivieren")).toBeTruthy();
  });

  it("translates constant tables and mappers when the language is read", () => {
    useI18nStore.getState().setRemote("de", "os.idp.mfa", { "MFA_CONFIG.EMAIL_LABEL": "E-Mail" });
    useI18nStore.getState().setRemote("de", "os.idp.captcha", {
      "CAPTCHA_MODEL.GENERATOR_HARD": "Schwer",
    });
    useI18nStore.getState().setRemote("de", "os.idp.security", {
      "SESSION_MAPPER.UNKNOWN_DEVICE": "Unbekanntes Gerät",
      "SESSION_MAPPER.APPS_one": "{{count}} Anwendung",
    });
    setLanguage("de");

    expect(MFA_PROVIDER_DATA[0].label).toBe("E-Mail");
    expect(CAPTCHA_GENERATOR_TYPE.HardCaptchaGenerator.label).toBe("Schwer");
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
    expect(card.deviceName).toBe("Unbekanntes Gerät");
    expect(card.applicationSummary).toBe("1 Anwendung");

    setLanguage("en");
    expect(MFA_PROVIDER_DATA[0].label).toBe("Email");
  });
});
