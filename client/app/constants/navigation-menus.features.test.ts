import { afterEach, describe, expect, it, vi } from "vitest";

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

const setAgentsFeature = (value: string | undefined) => {
  const w = window as BlocksWindow;
  w.__BLOCKS_ENV__ = { ...w.__BLOCKS_ENV__, BLOCKS_FEATURE_AGENTS: value };
};

// The menu list is fixed when the module loads, so each case loads it afresh.
const loadMenuIds = async () => {
  vi.resetModules();
  const { navigationMenus } = await import("./navigation-menus");
  return navigationMenus.map((menu) => menu.id);
};

describe("navigationMenus and the agents feature", () => {
  afterEach(() => setAgentsFeature(undefined));

  it("leaves out AI credits and its separator when the agents feature is off", async () => {
    const ids = await loadMenuIds();
    expect(ids).not.toContain("ai-credits");
    expect(ids).not.toContain("separator-ai-credits");
    expect(ids).toContain("overview-project");
  });

  it("lists AI credits when the agents feature is on", async () => {
    setAgentsFeature("true");
    const ids = await loadMenuIds();
    expect(ids).toContain("ai-credits");
    expect(ids).toContain("separator-ai-credits");
  });
});
