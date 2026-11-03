import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";
import { plural } from "./trace-story.util";

describe("trace story texts in a non-default language", () => {
  afterEach(() => useAppSettingsStore.getState().setSettings({ language: "en" }));

  it("counts steps in the chosen language", () => {
    useI18nStore.getState().setRemote("xx", "os.lmt", {
      "TRACE_STORY_UTIL.COUNT_STEP_one": "{{count}} xx-step",
      "TRACE_STORY_UTIL.COUNT_STEP_other": "{{count}} xx-steps",
    });
    expect(plural(2, "step")).toBe("2 steps");

    useAppSettingsStore.getState().setSettings({ language: "xx" });
    expect(plural(1, "step")).toBe("1 xx-step");
    expect(plural(2, "step")).toBe("2 xx-steps");
  });
});
