import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NOTIFICATION_I18N_MODULE } from "../i18n";
import { lastSeenText } from "../utils/push-format";
import { PushGuideDialog } from "./push-guide-dialog";
import { ResultBadge } from "./push-result-badge";

const GERMAN = {
  "PUSH_GUIDE.TITLE": "Einrichtungsanleitung — Push",
  "PUSH_GUIDE.KEY_GROUP": "Für alle Plattformen erforderlich",
  "PUSH_UI.RESULT_DELIVERED": "Zugestellt",
  "PUSH_FORMAT.TODAY": "heute",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.communication.notification German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German in a dialog, a badge and a helper", () => {
    useI18nStore.getState().setRemote("de", NOTIFICATION_I18N_MODULE, GERMAN);
    setLanguage("de");

    render(
      <>
        <PushGuideDialog open onClose={() => undefined} />
        <ResultBadge code="delivered" />
      </>,
    );
    expect(screen.getByText("Einrichtungsanleitung — Push")).toBeTruthy();
    expect(screen.getByText("Für alle Plattformen erforderlich")).toBeTruthy();
    expect(screen.getByText("Zugestellt")).toBeTruthy();
    expect(lastSeenText(new Date().toISOString())).toBe("heute");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    render(<ResultBadge code="delivered" />);
    expect(screen.getByText("Delivered")).toBeTruthy();
    expect(lastSeenText(new Date().toISOString())).toBe("today");
  });
});
