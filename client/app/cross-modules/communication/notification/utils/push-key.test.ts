import { describe, expect, it } from "vitest";
import {
  buildServiceAccountKey,
  isServiceAccountKey,
  keyProjectId,
  normalizePrivateKey,
} from "./push-key";

const PROJECT = "shop-app";
const EMAIL = "svc@shop-app.iam";
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

describe("buildServiceAccountKey", () => {
  const fields = { projectId: ` ${PROJECT} `, clientEmail: EMAIL, privateKey: PEM };

  it("builds the same JSON fields a key file holds", () => {
    expect(JSON.parse(buildServiceAccountKey(fields)!)).toEqual({
      type: "service_account",
      project_id: PROJECT,
      client_email: EMAIL,
      private_key: PEM,
    });
  });

  it("refuses a missing field or text that is not a private key", () => {
    expect(buildServiceAccountKey({ ...fields, clientEmail: " " })).toBeNull();
    expect(buildServiceAccountKey({ ...fields, privateKey: "hello" })).toBeNull();
  });
});
