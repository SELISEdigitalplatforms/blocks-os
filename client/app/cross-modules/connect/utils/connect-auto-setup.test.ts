import { beforeEach, describe, expect, it } from "vitest";
import { IConnectTemplate } from "@/cross-modules/connect/models/connect.model";
import {
  claimAutoSetupAttempt,
  pickAutoSetupTemplate,
  resetAutoSetupAttempts,
} from "./connect-auto-setup";

const template = (key: string) => ({ key }) as IConnectTemplate;

describe("pickAutoSetupTemplate", () => {
  it("prefers the localization template", () => {
    expect(pickAutoSetupTemplate([template("other"), template("localization")])?.key).toBe(
      "localization",
    );
  });

  it("falls back to the only active template", () => {
    expect(pickAutoSetupTemplate([template("other")])?.key).toBe("other");
  });

  it("picks nothing when several templates exist and none is the default", () => {
    expect(pickAutoSetupTemplate([template("a"), template("b")])).toBeUndefined();
    expect(pickAutoSetupTemplate([])).toBeUndefined();
  });
});

describe("claimAutoSetupAttempt", () => {
  beforeEach(() => resetAutoSetupAttempts());

  it("allows one attempt per tenant", () => {
    expect(claimAutoSetupAttempt("tenant-1")).toBe(true);
    expect(claimAutoSetupAttempt("tenant-1")).toBe(false);
    expect(claimAutoSetupAttempt("tenant-2")).toBe(true);
  });

  it("never claims a blank tenant", () => {
    expect(claimAutoSetupAttempt("")).toBe(false);
  });
});
