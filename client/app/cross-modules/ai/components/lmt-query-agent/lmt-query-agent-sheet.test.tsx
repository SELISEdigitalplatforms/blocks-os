import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LMTQueryAgentSheet } from "./lmt-query-agent-sheet";

vi.mock("./lmt-query-agent", () => ({
  LMTQueryAgent: () => <div data-testid="lmt-query-agent" />,
}));

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

const setAgentsFeature = (value: string | undefined) => {
  const w = window as BlocksWindow;
  w.__BLOCKS_ENV__ = { ...w.__BLOCKS_ENV__, BLOCKS_FEATURE_AGENTS: value };
};

describe("LMTQueryAgentSheet", () => {
  afterEach(() => setAgentsFeature(undefined));

  it("renders nothing when the agents feature is off", () => {
    const { container } = render(<LMTQueryAgentSheet agentName="Blocks Agent" />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers the agent button when the agents feature is on", () => {
    setAgentsFeature("true");
    render(<LMTQueryAgentSheet agentName="Blocks Agent" />);
    expect(screen.getByRole("button", { name: /Blocks Agent/ })).toBeTruthy();
  });
});
