import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { plural } from "./trace-story.util";

describe("trace story texts in German", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("counts steps in the chosen language", () => {
    useI18nStore.getState().setRemote("de", "os.lmt", {
      "TRACE_STORY_UTIL.COUNT_STEP_one": "{{count}} Schritt",
      "TRACE_STORY_UTIL.COUNT_STEP_other": "{{count}} Schritte",
    });
    expect(plural(2, "step")).toBe("2 steps");

    useAppSettingsStore.getState().setSettings({ language: "de" });
    expect(plural(1, "step")).toBe("1 Schritt");
    expect(plural(2, "step")).toBe("2 Schritte");
  });
});
