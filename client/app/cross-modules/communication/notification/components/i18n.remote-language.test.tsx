import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NOTIFICATION_I18N_MODULE } from "../i18n";
import { lastSeenText } from "../utils/push-format";
import { PushGuideDialog } from "./push-guide-dialog";
import { ResultBadge } from "./push-result-badge";

const REMOTE = {
  "PUSH_GUIDE.TITLE": "[xx] PUSH_GUIDE.TITLE",
  "PUSH_GUIDE.KEY_GROUP": "[xx] PUSH_GUIDE.KEY_GROUP",
  "PUSH_UI.RESULT_DELIVERED": "[xx] PUSH_UI.RESULT_DELIVERED",
  "PUSH_FORMAT.TODAY": "[xx] PUSH_FORMAT.TODAY",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.communication.notification non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows non-default language in a dialog, a badge and a helper", () => {
    useI18nStore.getState().setRemote("xx", NOTIFICATION_I18N_MODULE, REMOTE);
    setLanguage("xx");

    render(
      <>
        <PushGuideDialog open onClose={() => undefined} />
        <ResultBadge code="delivered" />
      </>,
    );
    expect(screen.getByText("[xx] PUSH_GUIDE.TITLE")).toBeTruthy();
    expect(screen.getByText("[xx] PUSH_GUIDE.KEY_GROUP")).toBeTruthy();
    expect(screen.getByText("[xx] PUSH_UI.RESULT_DELIVERED")).toBeTruthy();
    expect(lastSeenText(new Date().toISOString())).toBe("[xx] PUSH_FORMAT.TODAY");
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    render(<ResultBadge code="delivered" />);
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(lastSeenText(new Date().toISOString())).toBe("today");
  });
});
