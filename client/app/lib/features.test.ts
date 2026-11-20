import { afterEach, describe, expect, it } from "vitest";
import { isAgentsEnabled, isFeatureEnabled, isStudioEnabled } from "./features";

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

const setEnv = (values: Record<string, string | undefined>) => {
  const w = window as BlocksWindow;
  w.__BLOCKS_ENV__ = { ...w.__BLOCKS_ENV__, ...values };
};

describe("features", () => {
  afterEach(() => {
    setEnv({ BLOCKS_FEATURE_AGENTS: undefined, BLOCKS_FEATURE_STUDIO: undefined });
  });

  it("is off when the setting is not configured", () => {
    expect(isAgentsEnabled()).toBe(false);
    expect(isStudioEnabled()).toBe(false);
  });

  it("is off while the deployment placeholder is still unresolved", () => {
    setEnv({ BLOCKS_FEATURE_AGENTS: "__BLOCKS_FEATURE_AGENTS__" });
    expect(isAgentsEnabled()).toBe(false);
  });

  it("is off for any value other than true", () => {
    for (const value of ["false", "1", "yes", "on", ""]) {
      setEnv({ BLOCKS_FEATURE_STUDIO: value });
      expect(isFeatureEnabled("BLOCKS_FEATURE_STUDIO")).toBe(false);
    }
  });

  it("is on for true, ignoring case and surrounding spaces", () => {
    setEnv({ BLOCKS_FEATURE_AGENTS: " True " });
    expect(isAgentsEnabled()).toBe(true);
    expect(isStudioEnabled()).toBe(false);
  });
});
