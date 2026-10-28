import { describe, expect, it } from "vitest";
import { checkWebConfig, parseWebConfig, type IWebConfigFields } from "./push-web-config";

const API_KEY = "AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q";
const SENDER = "123456789012";
const APP_ID = `1:${SENDER}:web:abc123def456`;
const VAPID = "B".repeat(87);
const PROJECT = "my-app-123";

const SNIPPET = `const firebaseConfig = {
  apiKey: "${API_KEY}",
  authDomain: "${PROJECT}.firebaseapp.com",
  projectId: "${PROJECT}",
  storageBucket: "${PROJECT}.appspot.com",
  messagingSenderId: "${SENDER}",
  appId: "${APP_ID}"
};
alert("not run");`;

const fields = (patch: Partial<IWebConfigFields> = {}): IWebConfigFields => ({
  apiKey: API_KEY,
  appId: APP_ID,
  messagingSenderId: SENDER,
  vapidKey: VAPID,
  ...patch,
});

describe("parseWebConfig", () => {
  it("reads a firebaseConfig JS snippet without running it and ignores other fields", () => {
    expect(parseWebConfig(SNIPPET)).toEqual({
      apiKey: API_KEY,
      appId: APP_ID,
      messagingSenderId: SENDER,
      projectId: PROJECT,
    });
  });

  it("reads quoted JSON keys and a numeric sender id", () => {
    const json = JSON.stringify({
      apiKey: API_KEY,
      appId: APP_ID,
      messagingSenderId: Number(SENDER),
    });
    expect(parseWebConfig(json)).toMatchObject({ apiKey: API_KEY, messagingSenderId: SENDER });
  });

  it.each(["hello world", '{"apiKey":"x"}', ""])("says no for %j", (text) => {
    expect(parseWebConfig(text)).toBeNull();
  });
});

describe("checkWebConfig", () => {
  it("accepts a good config for the key's project", () => {
    expect(checkWebConfig(fields({ projectId: PROJECT }), PROJECT, true)).toBeNull();
  });

  it("blocks a config for another project and one with no key to compare", () => {
    expect(checkWebConfig(fields({ projectId: "other" }), PROJECT, true)).toBe("otherProject");
    expect(checkWebConfig(fields(), null, true)).toBe("needKey");
  });

  it("blocks an App ID whose number is not the Sender ID", () => {
    expect(checkWebConfig(fields({ messagingSenderId: "999" }), PROJECT, false)).toBe(
      "otherSender",
    );
  });

  it("asks for the VAPID key in paste mode and for all fields in manual mode", () => {
    expect(checkWebConfig(fields({ vapidKey: "" }), PROJECT, true)).toBe("needVapid");
    expect(checkWebConfig(fields({ vapidKey: "" }), PROJECT, false)).toBe("fillAll");
  });

  it("flags an App ID in the wrong shape", () => {
    expect(checkWebConfig(fields({ appId: "nonsense" }), PROJECT, false)).toBe("appIdFormat");
  });
});
