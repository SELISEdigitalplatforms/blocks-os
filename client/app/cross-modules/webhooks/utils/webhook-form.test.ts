import { describe, expect, it } from "vitest";
import { makeWebhook, SIGNING_SECRET } from "../test-utils/__mocks__";
import {
  createWebhookFormSchema,
  fieldErrorForCode,
  toSavePayload,
  toWebhookFormValues,
  type WebhookFormValues,
} from "./webhook-form";

const ACTION_NAME = "iam.user.created";
const INSECURE_URL = ["http", "crm.acme.com"].join("://");

const valid: WebhookFormValues = {
  name: "CRM",
  url: "https://crm.acme.com/hook",
  secret: SIGNING_SECRET,
  isActive: true,
  actions: [ACTION_NAME],
};

const failedFields = (
  schema: ReturnType<typeof createWebhookFormSchema>,
  values: WebhookFormValues,
) => {
  const result = schema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
};

describe("createWebhookFormSchema", () => {
  it("accepts a complete new webhook", () => {
    expect(failedFields(createWebhookFormSchema(false), valid)).toEqual([]);
  });

  it("needs a secret of at least 32 characters when creating", () => {
    const schema = createWebhookFormSchema(false);

    expect(failedFields(schema, { ...valid, secret: "" })).toEqual(["secret"]);
    expect(failedFields(schema, { ...valid, secret: "short" })).toEqual(["secret"]);
  });

  it("lets an edit leave the secret empty, but still checks a new one", () => {
    const schema = createWebhookFormSchema(true);

    expect(failedFields(schema, { ...valid, secret: "" })).toEqual([]);
    expect(failedFields(schema, { ...valid, secret: "short" })).toEqual(["secret"]);
  });

  it("refuses a URL that is not https and an empty action list", () => {
    const schema = createWebhookFormSchema(false);

    expect(failedFields(schema, { ...valid, url: INSECURE_URL })).toEqual(["url"]);
    expect(failedFields(schema, { ...valid, actions: [] })).toEqual(["actions"]);
  });

  it("refuses a blank name", () => {
    expect(failedFields(createWebhookFormSchema(false), { ...valid, name: "   " })).toEqual([
      "name",
    ]);
  });
});

const HIDDEN_ACTION = "iam.user.deactivated";

describe("toSavePayload", () => {
  it("leaves the secret out on an edit when the field is empty, so the current one is kept", () => {
    const payload = toSavePayload({ ...valid, secret: "" }, makeWebhook(), makeWebhook().actions);

    expect(payload).toEqual({
      id: "wh-1",
      name: "CRM",
      url: "https://crm.acme.com/hook",
      isActive: true,
      actions: [ACTION_NAME],
    });
    expect("secret" in payload).toBe(false);
  });

  it("keeps actions the form could not show (Webhook switch now off) on an edit", () => {
    const payload = toSavePayload(
      { ...valid, secret: "" },
      makeWebhook({ actions: [ACTION_NAME, HIDDEN_ACTION] }),
      [ACTION_NAME],
    );

    expect(payload.actions).toEqual([ACTION_NAME, HIDDEN_ACTION]);
  });

  it("drops an action the admin unticked", () => {
    const payload = toSavePayload(
      { ...valid, secret: "", actions: [ACTION_NAME] },
      makeWebhook({ actions: [ACTION_NAME, HIDDEN_ACTION] }),
      [ACTION_NAME, HIDDEN_ACTION],
    );

    expect(payload.actions).toEqual([ACTION_NAME]);
  });

  it("sends the new secret on create, without an id", () => {
    const payload = toSavePayload(valid, null);

    expect(payload.secret).toBe(SIGNING_SECRET);
    expect("id" in payload).toBe(false);
  });
});

describe("toWebhookFormValues", () => {
  it("never carries a secret into the edit form and drops actions that no longer send to webhooks", () => {
    const values = toWebhookFormValues(makeWebhook(), [ACTION_NAME]);

    expect(values.secret).toBe("");
    expect(values.actions).toEqual([ACTION_NAME]);
  });
});

describe("fieldErrorForCode", () => {
  it.each([
    ["WEBHOOK_NAME_TAKEN", "name"],
    ["NAME_REQUIRED", "name"],
    ["URL_NOT_ALLOWED", "url"],
    ["SECRET_REQUIRED", "secret"],
    ["SECRET_INVALID", "secret"],
    ["ACTIONS_REQUIRED", "actions"],
    ["ACTION_NOT_FOUND", "actions"],
  ])("puts %s on the %s field", (code, field) => {
    expect(fieldErrorForCode(code)?.field).toBe(field);
  });

  it("leaves other codes to a toast", () => {
    expect(fieldErrorForCode("WEBHOOK_NOT_FOUND")).toBeNull();
  });
});
