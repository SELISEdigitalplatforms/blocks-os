import { describe, expect, it } from "vitest";
import { FakeHttpError } from "@/cross-modules/secrets/test-utils/secret.fixtures";
import { describeSecretError, isSecretPermissionError, isStaleSecretError } from "./secret-error";

describe("describeSecretError", () => {
  it("maps a field reason code onto its field with its own copy", () => {
    const info = describeSecretError(
      new FakeHttpError(400, {
        invalid_request: "'x y' is not a valid name.",
        reason: "NAME_INVALID",
      }),
    );
    expect(info.status).toBe(400);
    expect(info.reason).toBe("NAME_INVALID");
    expect(info.field).toBe("name");
    expect(info.message).toBe(
      "Use letters, digits, dot, underscore or hyphen, starting with a letter or digit.",
    );
  });

  it.each([
    ["NAME_INVALID", "name"],
    ["NAME_TOO_LONG", "name"],
    ["NAME_REQUIRED", "name"],
    ["DESCRIPTION_TOO_LONG", "description"],
    ["VALUE_REQUIRED", "value"],
    ["VALUE_TOO_LARGE", "value"],
    ["INVALID_TYPE", "type"],
  ])("routes %s to the %s field", (reason, field) => {
    const info = describeSecretError(new FakeHttpError(400, { reason }));
    expect(info.field).toBe(field);
  });

  it("leaves batch reasons unattached to any field", () => {
    expect(describeSecretError(new FakeHttpError(400, { reason: "BATCH_TOO_LARGE" })).field).toBe(
      undefined,
    );
  });

  it("gives 403 a non-alarming permission message", () => {
    const info = describeSecretError(new FakeHttpError(403, { access_denied: "denied" }));
    expect(info.status).toBe(403);
    expect(info.message).toMatch(/do not have permission/i);
  });

  it("tells the caller a 404 row is gone", () => {
    expect(describeSecretError(new FakeHttpError(404, {})).message).toMatch(/no longer exists/i);
  });

  it("explains a 409 as a stale view rather than a failure", () => {
    expect(describeSecretError(new FakeHttpError(409, {})).message).toMatch(/status has changed/i);
  });

  it("keeps the 502 message generic", () => {
    // The underlying vault error can name hosts and credential types.
    const info = describeSecretError(
      new FakeHttpError(502, { vault_unavailable: "kv-prod-01.vault.azure.net refused" }),
    );
    expect(info.message).toMatch(/secret store is currently unavailable/i);
    expect(info.message).not.toMatch(/vault\.azure\.net/);
  });

  it("falls back to the server message when no reason or status copy applies", () => {
    const info = describeSecretError(new FakeHttpError(418, { teapot: "I am a teapot" }));
    expect(info.message).toBe("I am a teapot");
  });

  it("falls back to the supplied default for an unrecognised error", () => {
    expect(describeSecretError(new Error("boom"), "Could not do the thing.").message).toBe(
      "Could not do the thing.",
    );
  });
});

describe("archived value reads", () => {
  const archivedRead = () =>
    new FakeHttpError(400, {
      invalid_request: "This secret is archived. Restore it to read its value.",
      reason: "STATUS_DELETED",
    });

  it("explains a 400 STATUS_DELETED as an archived secret", () => {
    const info = describeSecretError(archivedRead(), "Could not read the secret value.");
    expect(info.status).toBe(400);
    expect(info.reason).toBe("STATUS_DELETED");
    expect(info.message).toBe("This secret is archived. Restore it to read its value.");
    expect(info.field).toBeUndefined();
  });

  it("treats a 400 STATUS_DELETED as a stale view, so the list refreshes", () => {
    expect(isStaleSecretError(archivedRead())).toBe(true);
  });

  it("does not treat other 400s as stale", () => {
    expect(isStaleSecretError(new FakeHttpError(400, { reason: "NAME_INVALID" }))).toBe(false);
    expect(isStaleSecretError(new FakeHttpError(400, {}))).toBe(false);
  });

  it("keeps the stale-view copy for STATUS_DELETED on a lifecycle action's 409", () => {
    const info = describeSecretError(new FakeHttpError(409, { reason: "STATUS_DELETED" }));
    expect(info.message).toBe("The secret's status has changed. Refresh and try again.");
  });

  it("keeps 409 STATUS_LOCKED unchanged", () => {
    const error = new FakeHttpError(409, { reason: "STATUS_LOCKED" });
    expect(describeSecretError(error).message).toBe(
      "The secret's status has changed. Refresh and try again.",
    );
    expect(isStaleSecretError(error)).toBe(true);
  });
});

describe("error predicates", () => {
  it("treats 404 and 409 as a stale view", () => {
    expect(isStaleSecretError(new FakeHttpError(404, {}))).toBe(true);
    expect(isStaleSecretError(new FakeHttpError(409, {}))).toBe(true);
    expect(isStaleSecretError(new FakeHttpError(403, {}))).toBe(false);
    expect(isStaleSecretError(new Error("boom"))).toBe(false);
  });

  it("identifies permission errors", () => {
    expect(isSecretPermissionError(new FakeHttpError(403, {}))).toBe(true);
    expect(isSecretPermissionError(new FakeHttpError(400, {}))).toBe(false);
  });
});
