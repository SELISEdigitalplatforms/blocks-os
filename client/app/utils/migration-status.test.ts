import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-project", () => ({ MIGRATION_ONGOING_WINDOW_MS: 10 * 60 * 1000 }));

import {
  getMigrationNotificationOutcome,
  getMigrationState,
  getMigrationStateForTarget,
} from "./migration-status";

const NOW = Date.parse("2026-10-23T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60 * 1000).toISOString();
const TARGET = "t-1";
const RUNNING = "in-progress";
const tracker = (extra: Record<string, unknown> = {}, createdDate = minutesAgo(1)) => ({
  targetedProjectKey: TARGET,
  createdDate,
  ...extra,
});

describe("getMigrationState", () => {
  it("is in progress while a service is neither done nor failed", () => {
    const t = tracker({ iam: { isCompleted: true }, mfa: { isCompleted: false } });
    expect(getMigrationState(t, NOW)).toBe(RUNNING);
  });

  it("is failed when every unfinished service carries an error", () => {
    const t = tracker({
      iam: { isCompleted: true },
      mfa: { isCompleted: false, errorMessage: "boom" },
    });
    expect(getMigrationState(t, NOW)).toBe("failed");
  });

  it("is failed as soon as one service failed, even while another still runs", () => {
    const t = tracker({
      iam: { isCompleted: false, errorMessage: "boom" },
      mfa: { isCompleted: false },
    });
    expect(getMigrationState(t, NOW)).toBe("failed");
  });

  it("is done when every service finished", () => {
    const t = tracker({ iam: { isCompleted: true }, mfa: { isCompleted: true } });
    expect(getMigrationState(t, NOW)).toBe("done");
  });

  it("is done once the ongoing window has passed, whatever the services say", () => {
    const t = tracker({ iam: { isCompleted: false } }, minutesAgo(11));
    expect(getMigrationState(t, NOW)).toBe("done");
  });

  it("falls back to the time window when the tracker carries no service detail", () => {
    expect(getMigrationState(tracker(), NOW)).toBe(RUNNING);
    expect(getMigrationState(tracker({}, minutesAgo(11)), NOW)).toBe("done");
  });

  it("is done for a tracker without a created date", () => {
    expect(getMigrationState({ targetedProjectKey: TARGET }, NOW)).toBe("done");
  });

  it("ignores non-service fields", () => {
    const t = tracker({ note: null, count: 3, list: [1], iam: { isCompleted: true } });
    expect(getMigrationState(t, NOW)).toBe("done");
  });
});

describe("getMigrationStateForTarget", () => {
  const running = tracker({ iam: { isCompleted: false } });
  const failed = tracker({ iam: { isCompleted: false, errorMessage: "x" } });

  it("is done without a list", () => {
    expect(getMigrationStateForTarget(undefined, TARGET, NOW)).toBe("done");
  });

  it("only looks at trackers aimed at that environment", () => {
    expect(getMigrationStateForTarget([running], "other", NOW)).toBe("done");
  });

  it("prefers running over failed, and failed over done", () => {
    expect(getMigrationStateForTarget([failed, running], TARGET, NOW)).toBe(RUNNING);
    expect(getMigrationStateForTarget([failed], TARGET, NOW)).toBe("failed");
  });
});

describe("getMigrationNotificationOutcome", () => {
  it("reads IsSuccess from the message", () => {
    expect(getMigrationNotificationOutcome({ message: { IsSuccess: false, title: "T" } })).toEqual({
      isSuccess: false,
      title: "T",
      description: undefined,
    });
  });

  it("reads a lowercase flag from a denormalized payload sent as a string", () => {
    const denormalizedPayload = JSON.stringify({ isSuccess: true, description: "ok" });
    expect(getMigrationNotificationOutcome({ message: { denormalizedPayload } })).toEqual({
      isSuccess: true,
      title: undefined,
      description: "ok",
    });
  });

  it("reads a message that arrives as a JSON string", () => {
    const message = JSON.stringify({ IsSuccess: true });
    expect(getMigrationNotificationOutcome({ message })?.isSuccess).toBe(true);
  });

  it("returns undefined when there is no outcome to read", () => {
    expect(getMigrationNotificationOutcome(undefined)).toBeUndefined();
    expect(getMigrationNotificationOutcome({ message: "not json" })).toBeUndefined();
    expect(getMigrationNotificationOutcome({ message: { title: "x" } })).toBeUndefined();
    expect(getMigrationNotificationOutcome({ message: { IsSuccess: "yes" } })).toBeUndefined();
  });
});
