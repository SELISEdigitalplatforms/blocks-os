import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MailStatus } from "@blocks-communication/mail/models/email";
import { StatusBadge } from "./status-badge";
import { formatMailDateLong } from "./mail-display";

const REMOTE_MAIL = {
  "MAIL_STATUS.DELIVERED": "[xx] MAIL_STATUS.DELIVERED",
  "MAIL_DISPLAY.WEEKDAY_MON": "[xx] MAIL_DISPLAY.WEEKDAY_MON",
  "MAIL_DISPLAY.MONTH_MAR": "[xx] MAIL_DISPLAY.MONTH_MAR",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.communication.mail non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows non-default language in a component and in the date helper", () => {
    useI18nStore.getState().setRemote("xx", "os.communication.mail", REMOTE_MAIL);
    setLanguage("xx");

    render(<StatusBadge status={MailStatus.Delivered} />);
    expect(screen.getByText("[xx] MAIL_STATUS.DELIVERED")).toBeTruthy();
    expect(formatMailDateLong(new Date(2024, 2, 4, 9, 5))).toBe(
      "[xx] MAIL_DISPLAY.WEEKDAY_MON, 4 [xx] MAIL_DISPLAY.MONTH_MAR 2024, 09:05",
    );
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    render(<StatusBadge status={MailStatus.Delivered} />);
    expect(screen.getByText("Delivered")).toBeTruthy();
  });
});
