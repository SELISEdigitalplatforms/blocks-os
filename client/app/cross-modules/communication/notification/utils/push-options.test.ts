import { describe, expect, it } from "vitest";
import {
  buildNotificationTestRequest,
  buildPushOptions,
  EMPTY_PUSH_OPTIONS,
  pushOptionsErrors,
  toPushOptionValues,
  toPushPlatforms,
} from "./push-options";

const withValues = (patch: Partial<typeof EMPTY_PUSH_OPTIONS>) => ({
  ...EMPTY_PUSH_OPTIONS,
  ...patch,
});

const PLAIN_LINK = ["http", "://a.b"].join("");
const SECURE_LINK = "https://a.b";

describe("buildPushOptions", () => {
  it("sends only what the user filled; empty tabs are null", () => {
    const options = buildPushOptions(
      withValues({
        webLink: " https://app.example.com/o ",
        android: {
          ...EMPTY_PUSH_OPTIONS.android,
          priority: "high",
          ttl: "86400",
          channelId: "orders",
        },
        web: { ...EMPTY_PUSH_OPTIONS.web, requireInteraction: true },
      }),
    );
    expect(options).toEqual({
      webLink: "https://app.example.com/o",
      android: { priority: "high", ttlSeconds: 86400, channelId: "orders" },
      ios: null,
      web: { requireInteraction: true },
    });
  });

  it("round-trips stored options back into the form", () => {
    const stored = {
      webLink: SECURE_LINK,
      ios: { badge: 3, interruptionLevel: "passive" as const },
    };
    expect(buildPushOptions(toPushOptionValues(stored))).toMatchObject(stored);
  });
});

describe("pushOptionsErrors", () => {
  it("accepts the defaults", () => {
    expect(pushOptionsErrors(EMPTY_PUSH_OPTIONS)).toEqual([]);
  });

  it("refuses a non-https link, a bad colour, a bad badge and a bad token", () => {
    const errors = pushOptionsErrors(
      withValues({
        webLink: PLAIN_LINK,
        android: { ...EMPTY_PUSH_OPTIONS.android, color: "blue", sound: "no spaces" },
        ios: { ...EMPTY_PUSH_OPTIONS.ios, badge: "12345" },
      }),
    );
    expect(errors).toHaveLength(4);
  });
});

describe("push platforms", () => {
  it("reads missing or empty platforms as all three", () => {
    expect(toPushPlatforms(null)).toEqual(["android", "ios", "web"]);
    expect(toPushPlatforms([])).toEqual(["android", "ios", "web"]);
    expect(toPushPlatforms(["ios"])).toEqual(["ios"]);
  });
});

describe("buildNotificationTestRequest", () => {
  it("sends the unsaved draft with its platforms and options", () => {
    const request = buildNotificationTestRequest({
      titleKey: "t",
      bodyKey: "b",
      link: " myapp://x ",
      pushPlatforms: ["android"],
      pushOptions: withValues({ webLink: SECURE_LINK }),
    });
    expect(request).toMatchObject({
      titleKey: "t",
      bodyKey: "b",
      link: "myapp://x",
      webLink: SECURE_LINK,
      platforms: ["android"],
    });
  });
});
