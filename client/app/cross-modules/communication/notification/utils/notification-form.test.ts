import { describe, expect, it } from "vitest";
import type { INotificationConfigRow } from "../models/notification-config.model";
import {
  EMPTY_FORM_VALUES,
  buildSavePayload,
  toFormValues,
  validateNotificationForm,
  type NotificationFormValues,
} from "./notification-form";
import { EMPTY_PUSH_OPTIONS } from "./push-options";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";

const EVENT_NAME = "orders-paid";
const CREATE = { locked: false, isEdit: false };

const valid = (patch: Partial<NotificationFormValues> = {}): NotificationFormValues => ({
  ...EMPTY_FORM_VALUES,
  name: EVENT_NAME,
  ...patch,
});

const row = (patch: Partial<INotificationConfigRow> = {}): INotificationConfigRow =>
  ({
    itemId: "n-1",
    name: EVENT_NAME,
    channelToNotify: 1,
    notificationType: 2,
    notifyMethod: "orders",
    enablePersistence: true,
    ...patch,
  }) as INotificationConfigRow;

const PLAIN_LINK = ["http", "://a.b"].join("");

describe("validateNotificationForm", () => {
  const ctx = { locked: false, isEdit: false };

  it("accepts a plain new notification", () => {
    expect(validateNotificationForm(valid(), ctx)).toEqual([]);
  });

  it("needs at least one group to send to", () => {
    const errors = validateNotificationForm(valid({ sendProject: false, sendConsole: false }), ctx);
    expect(errors).toEqual([NOTIFICATION_TEXT.errors.sendTo]);
  });

  it("needs in-app or push", () => {
    const errors = validateNotificationForm(valid({ liveEnabled: false, pushEnabled: false }), ctx);
    expect(errors).toEqual([NOTIFICATION_TEXT.errors.channel]);
  });

  it("needs both keys when push is on", () => {
    const errors = validateNotificationForm(valid({ pushEnabled: true, titleKey: "T" }), ctx);
    expect(errors).toEqual([NOTIFICATION_TEXT.errors.pushKeys]);
  });

  it.each(["", "abc", "601", "-1", "1.5"])("refuses the rate limit %j", (rateLimit) => {
    expect(validateNotificationForm(valid({ rateLimit }), ctx)).toContain(
      NOTIFICATION_TEXT.errors.rate,
    );
  });

  it.each(["0", "600"])("accepts the rate limit %s", (rateLimit) => {
    expect(validateNotificationForm(valid({ rateLimit }), ctx)).toEqual([]);
  });

  it("needs a context in every filled subscription filter and at most 20", () => {
    const missing = valid({ level: 2, filters: [{ context: "", actionName: "a", value: "" }] });
    expect(validateNotificationForm(missing, ctx)).toEqual([NOTIFICATION_TEXT.errors.filters]);
    const many = valid({
      level: 2,
      filters: Array.from({ length: 21 }, () => ({ context: "c", actionName: "", value: "" })),
    });
    expect(validateNotificationForm(many, ctx)).toEqual([NOTIFICATION_TEXT.errors.filters]);
  });

  it("limits the lists of a Selected audience", () => {
    const tooMany = valid({ level: 2, roles: Array.from({ length: 51 }, (_, i) => `r${i}`) });
    expect(validateNotificationForm(tooMany, ctx)).toEqual([NOTIFICATION_TEXT.errors.limits]);
  });

  it("does not check receivers or push text of a personal notice", () => {
    const personal = valid({
      sendProject: false,
      pushEnabled: true,
      level: 2,
      roles: Array.from({ length: 80 }, (_, i) => `r${i}`),
    });
    expect(validateNotificationForm(personal, { locked: true, isEdit: true })).toEqual([]);
  });

  it("does not re-check the name of an existing notification", () => {
    expect(validateNotificationForm(valid({ name: "x" }), { locked: false, isEdit: true })).toEqual(
      [],
    );
  });
});

describe("toFormValues", () => {
  it("reads an old row as in-app on, push off, consumer users, Targeted to the owner", () => {
    const values = toFormValues(row());
    expect(values).toMatchObject({
      sendProject: true,
      sendConsole: false,
      liveEnabled: true,
      pushEnabled: false,
      level: 2,
      alsoNamedUsers: true,
      rateLimit: "120",
    });
  });

  it("uses the tenant audience, else the built-in default, and ignores it when locked", () => {
    const audience = {
      level: 2,
      match: 1,
      userIds: ["u"],
      roles: [],
      permissions: [],
      filters: [],
      alsoNamedUsers: true,
    };
    const fallback = { ...audience, level: 1, userIds: [] };
    expect(toFormValues(row({ audience, defaultAudience: fallback }))).toMatchObject({
      level: 2,
      match: 1,
    });
    expect(toFormValues(row({ defaultAudience: fallback }))).toMatchObject({ level: 1 });
    expect(
      toFormValues(row({ audience, defaultAudience: fallback, audienceLocked: true })),
    ).toMatchObject({
      level: 1,
    });
  });
});

describe("buildSavePayload", () => {
  it.each([
    [true, false, 0],
    [false, true, 1],
    [true, true, 2],
  ])("maps project=%s console=%s to scope %i", (sendProject, sendConsole, scope) => {
    const payload = buildSavePayload(valid({ sendProject, sendConsole }), undefined, false, "t");
    expect(payload.scope).toBe(scope);
  });

  it("sends the rules of a Selected audience only", () => {
    const rules = {
      userIds: ["u1", "u1", " "],
      roles: ["sales"],
      permissions: ["orders::read"],
      alsoNamedUsers: true,
      match: 1,
      filters: [
        { context: " orders ", actionName: "", value: "" },
        { context: "", actionName: "", value: "" },
      ],
    };
    const selected = buildSavePayload(valid({ level: 2, ...rules }), undefined, false, "t");
    expect(selected.audience).toEqual({
      level: 2,
      match: 1,
      userIds: ["u1"],
      roles: ["sales"],
      permissions: ["orders::read"],
      filters: [{ context: "orders", actionName: "", value: "" }],
      alsoNamedUsers: true,
      alsoDoneBy: false,
    });
    const all = buildSavePayload(valid({ level: 1, ...rules }), undefined, false, "t");
    expect(all.audience).toEqual({
      level: 1,
      match: 0,
      userIds: [],
      roles: [],
      permissions: [],
      filters: [],
      alsoNamedUsers: false,
      alsoDoneBy: false,
    });
  });

  it("saves Targeted with only the event owner as the owner-only level the servers know", () => {
    const payload = buildSavePayload(
      valid({ level: 2, alsoNamedUsers: true }),
      undefined,
      false,
      "t",
    );
    expect(payload.audience).toEqual({
      level: 0,
      match: 0,
      userIds: [],
      roles: [],
      permissions: [],
      filters: [],
      alsoNamedUsers: false,
      alsoDoneBy: false,
    });
  });

  it("refuses Targeted with no event owner and nothing picked, which would reach nobody", () => {
    expect(validateNotificationForm(valid({ level: 2, alsoNamedUsers: false }), CREATE)).toContain(
      NOTIFICATION_TEXT.errors.targeted,
    );
    expect(
      validateNotificationForm(valid({ level: 2, alsoNamedUsers: false, roles: ["r"] }), CREATE),
    ).not.toContain(NOTIFICATION_TEXT.errors.targeted);
  });

  it("saves Done by as Targeted, never as the owner-only level", () => {
    const payload = buildSavePayload(
      valid({ level: 2, alsoNamedUsers: true, alsoDoneBy: true }),
      undefined,
      false,
      "t",
    );
    expect(payload.audience).toMatchObject({ level: 2, alsoNamedUsers: true, alsoDoneBy: true });
    expect(
      validateNotificationForm(
        valid({ level: 2, alsoNamedUsers: false, alsoDoneBy: true }),
        CREATE,
      ),
    ).not.toContain(NOTIFICATION_TEXT.errors.targeted);
  });

  it("drops Done by when All users is chosen", () => {
    const payload = buildSavePayload(valid({ level: 1, alsoDoneBy: true }), undefined, false, "t");
    expect(payload.audience?.alsoDoneBy).toBe(false);
  });

  it("keeps the push keys while push is off so they survive switching it back on", () => {
    const payload = buildSavePayload(
      valid({ pushEnabled: false, titleKey: "T", bodyKey: "B", link: " app://x " }),
      undefined,
      false,
      "t",
    );
    expect(payload.pushTemplate).toEqual({ titleKey: "T", bodyKey: "B", link: "app://x" });
    expect(payload.pushEnabled).toBe(false);
  });

  it("sends no audience, scope or push text for a personal notice", () => {
    const previous = row({ audienceLocked: true });
    const payload = buildSavePayload(
      { ...toFormValues(previous), liveEnabled: false, pushEnabled: true },
      previous,
      true,
      "t",
    );
    expect(payload).toMatchObject({ liveEnabled: false, pushEnabled: true, itemId: "n-1" });
    expect(payload).not.toHaveProperty("audience");
    expect(payload).not.toHaveProperty("scope");
    expect(payload).not.toHaveProperty("pushTemplate");
  });

  it("keeps the legacy fields of an existing row and sends only the changed metadata", () => {
    const previous = row({ description: "old", importance: 2 });
    const payload = buildSavePayload(
      { ...toFormValues(previous), description: "new text" },
      previous,
      true,
      "t",
    );
    expect(payload).toMatchObject({
      channelToNotify: 1,
      notificationType: 2,
      notifyMethod: "orders",
      description: "new text",
    });
    expect(payload).not.toHaveProperty("importance");
    expect(payload).not.toHaveProperty("isDisabled");
  });

  it("sends isDisabled only when the on/off switch changed", () => {
    const previous = row();
    const payload = buildSavePayload(
      { ...toFormValues(previous), isEnabled: false },
      previous,
      true,
      "t",
    );
    expect(payload.isDisabled).toBe(true);
  });

  it("uses the name as notify method for a new notification and marks it built-in on request", () => {
    const payload = buildSavePayload(
      valid({ name: " orders-paid ", isBuiltIn: true }),
      undefined,
      false,
      "t",
    );
    expect(payload).toMatchObject({ name: EVENT_NAME, notifyMethod: EVENT_NAME, isBuiltIn: true });
  });
});

describe("push platforms and options in the save payload", () => {
  it("sends the chosen platforms and the options built from the form", () => {
    const values = valid({
      pushPlatforms: ["android"],
      pushOptions: {
        ...EMPTY_PUSH_OPTIONS,
        webLink: "https://a.b/x",
        android: { ...EMPTY_PUSH_OPTIONS.android, priority: "high" },
      },
    });
    const payload = buildSavePayload(values, undefined, false, "tenant");
    expect(payload.pushPlatforms).toEqual(["android"]);
    expect(payload.pushOptions).toEqual({
      webLink: "https://a.b/x",
      android: { priority: "high" },
      ios: null,
      web: null,
    });
  });

  it("refuses a push with no platform chosen and a non-https web link", () => {
    const errors = validateNotificationForm(
      valid({
        pushEnabled: true,
        titleKey: "t",
        bodyKey: "b",
        pushPlatforms: [],
        pushOptions: { ...EMPTY_PUSH_OPTIONS, webLink: PLAIN_LINK },
      }),
      CREATE,
    );
    expect(errors).toHaveLength(2);
  });
});
