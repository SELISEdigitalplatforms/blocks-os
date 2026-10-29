import { describe, expect, it } from "vitest";
import {
  buildServiceAccountKey,
  isServiceAccountKey,
  keyProjectId,
  normalizePrivateKey,
  projectFromEmail,
} from "./push-key";

const PROJECT = "shop-app";
const EMAIL = "svc@shop-app.iam.gserviceaccount.com";
const KEY = JSON.stringify({
  type: "service_account",
  project_id: PROJECT,
  private_key: "fake-key-material",
  client_email: EMAIL,
});
const PEM = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n";

describe("isServiceAccountKey", () => {
  it.each([
    ["not json", false],
    ["null", false],
    ['{"type":"service_account"}', false],
    [KEY, true],
  ])("reads %s", (text, expected) => {
    expect(isServiceAccountKey(text)).toBe(expected);
  });
});

describe("keyProjectId", () => {
  it("reads the project id of a key and null for anything else", () => {
    expect(keyProjectId(KEY)).toBe(PROJECT);
    expect(keyProjectId("not json")).toBeNull();
  });
});

describe("normalizePrivateKey", () => {
  it("turns pasted \\n text and Windows line ends into real line breaks", () => {
    expect(
      normalizePrivateKey(String.raw`-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----`),
    ).toBe(PEM);
    expect(
      normalizePrivateKey("  -----BEGIN PRIVATE KEY-----\r\nabc\r\n-----END PRIVATE KEY-----\r\n"),
    ).toBe(PEM);
  });
});

describe("projectFromEmail", () => {
  it.each([
    ["firebase-adminsdk-x@my-app-123.iam.gserviceaccount.com", "my-app-123"],
    ["my-app-123@appspot.gserviceaccount.com", "my-app-123"],
    ["  Svc@My-App.iam.gserviceaccount.com ", "my-app"],
    ["svc@shop-app.iam", null],
    ["svc@evil.example.com", null],
    ["svc@x.iam.gserviceaccount.com.evil.com", null],
    ["", null],
  ])("reads %s", (email, expected) => {
    expect(projectFromEmail(email)).toBe(expected);
  });
});

describe("buildServiceAccountKey", () => {
  const fields = { clientEmail: EMAIL, privateKey: PEM };

  it("builds the key JSON with the project taken from the email", () => {
    const built = buildServiceAccountKey(fields);
    expect(built.ok && built.projectId).toBe(PROJECT);
    expect(JSON.parse(built.ok ? built.json : "{}")).toEqual({
      type: "service_account",
      project_id: PROJECT,
      client_email: EMAIL,
      private_key: PEM,
    });
  });

  it("refuses an email without a project and a missing or broken private key", () => {
    expect(buildServiceAccountKey({ ...fields, clientEmail: "a@b.com" })).toEqual({
      ok: false,
      reason: "email",
    });
    expect(buildServiceAccountKey({ ...fields, clientEmail: " " })).toEqual({
      ok: false,
      reason: "incomplete",
    });
    expect(buildServiceAccountKey({ ...fields, privateKey: "hello" })).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });
});
