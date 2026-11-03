import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MailStatus } from "@blocks-communication/mail/models/email";
import { StatusBadge } from "./status-badge";
import { formatMailDateLong } from "./mail-display";

const GERMAN_MAIL = {
  "MAIL_STATUS.DELIVERED": "Zugestellt",
  "MAIL_DISPLAY.WEEKDAY_MON": "Mo",
  "MAIL_DISPLAY.MONTH_MAR": "Mär",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.communication.mail German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German in a component and in the date helper", () => {
    useI18nStore.getState().setRemote("de", "os.communication.mail", GERMAN_MAIL);
    setLanguage("de");

    render(<StatusBadge status={MailStatus.Delivered} />);
    expect(screen.getByText("Zugestellt")).toBeTruthy();
    expect(formatMailDateLong(new Date(2024, 2, 4, 9, 5))).toBe("Mo, 4 Mär 2024, 09:05");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    render(<StatusBadge status={MailStatus.Delivered} />);
    expect(screen.getByText("Delivered")).toBeTruthy();
  });
});
