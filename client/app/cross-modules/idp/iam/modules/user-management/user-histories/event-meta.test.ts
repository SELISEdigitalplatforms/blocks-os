import { describe, expect, it } from "vitest";
import { EVENT_META, EVENT_TONE_CLASS, getEventMeta } from "./event-meta";

describe("getEventMeta", () => {
  it("returns the mapped entry for a known snake_case event", () => {
    const meta = getEventMeta("login_via_password");
    expect(meta.label).toBe("Sign in");
    expect(meta.tone).toBe("success");
    expect(meta).toBe(EVENT_META.login_via_password);
  });

  it("returns the mapped entry for a known upper-case event", () => {
    expect(getEventMeta("LOGIN_FAILURE").tone).toBe("error");
  });

  it("title-cases an unknown event and falls back to the info tone", () => {
    const meta = getEventMeta("some_new_event");
    expect(meta.label).toBe("Some New Event");
    expect(meta.description).toBe("some_new_event");
    expect(meta.tone).toBe("info");
  });

  it("handles a single-word unknown event", () => {
    expect(getEventMeta("unknown").label).toBe("Unknown");
  });
});

describe("EVENT_TONE_CLASS", () => {
  it("has a class for every tone", () => {
    expect(Object.keys(EVENT_TONE_CLASS).sort()).toEqual([
      "error",
      "info",
      "success",
      "warning",
    ]);
  });
});
