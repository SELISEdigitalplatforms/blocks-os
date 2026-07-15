import { afterEach, describe, expect, it } from "vitest";
import { getRuntimeEnv } from "./runtime-env";

type BlocksWindow = Window & {
  __BLOCKS_ENV__?: Record<string, string | undefined>;
};

describe("getRuntimeEnv", () => {
  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  it("prefers a non-placeholder value from the loadEnv map", () => {
    expect(
      getRuntimeEnv("BLOCKS_IAM_BASE_URL", {
        BLOCKS_IAM_BASE_URL: "https://from-loadenv",
      }),
    ).toBe("https://from-loadenv");
  });

  it("ignores placeholder values in the loadEnv map and falls back to window", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_IAM_BASE_URL: "https://from-window",
    };
    expect(
      getRuntimeEnv("BLOCKS_IAM_BASE_URL", {
        BLOCKS_IAM_BASE_URL: "__BLOCKS_IAM_BASE_URL__",
      }),
    ).toBe("https://from-window");
  });

  it("reads from window.__BLOCKS_ENV__ when present", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_OS_BASE_URL: "https://os-base",
    };
    expect(getRuntimeEnv("BLOCKS_OS_BASE_URL")).toBe("https://os-base");
  });

  it("ignores placeholder window values", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_OS_BASE_URL: "__BLOCKS_OS_BASE_URL__",
    };
    expect(getRuntimeEnv("BLOCKS_OS_BASE_URL")).toBe("");
  });

  it("returns an empty string when nothing resolves", () => {
    expect(getRuntimeEnv("BLOCKS_MONITOR_BASE_URL")).toBe("");
  });
});
