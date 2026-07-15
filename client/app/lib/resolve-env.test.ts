import { afterEach, describe, expect, it } from "vitest";
import { resolveEnv } from "./resolve-env";

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

describe("resolveEnv", () => {
  afterEach(() => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  it("replaces unresolved __BLOCKS_ placeholders using import.meta.env", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      SOME_KEY: "__BLOCKS_SOME_KEY__",
    };
    resolveEnv();
    // No matching import.meta.env value, so the placeholder resolves to "".
    expect((window as BlocksWindow).__BLOCKS_ENV__?.SOME_KEY).toBe("");
  });

  it("leaves already-resolved values untouched", () => {
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      SOME_KEY: "https://real.value",
    };
    resolveEnv();
    expect((window as BlocksWindow).__BLOCKS_ENV__?.SOME_KEY).toBe("https://real.value");
  });

  it("is a no-op when there is no __BLOCKS_ENV__", () => {
    delete (window as BlocksWindow).__BLOCKS_ENV__;
    expect(() => resolveEnv()).not.toThrow();
  });
});
