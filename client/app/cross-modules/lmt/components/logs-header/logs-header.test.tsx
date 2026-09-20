import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("nuqs", async () => {
  const react = await import("react");
  return {
    useQueryState: (_key: string, opts?: { defaultValue?: string }) =>
      react.useState(opts?.defaultValue ?? ""),
  };
});

vi.mock("@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet", () => ({
  LMTQueryAgentSheet: ({ agentName }: { agentName?: string }) => (
    <button type="button">{agentName ?? "Blocks Agent"}</button>
  ),
}));

// The tooltip kit re-exports genesis-os, whose inlined source drags the real http client --
// and with it a server-side Rollbar that cannot start under jsdom -- into the module graph.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    TooltipProvider: Passthrough,
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
  };
});

// Importing the viewer for its context would otherwise drag the hot list, the restored panel
// and with them the real http client into the module graph.
vi.mock("../logs-list", () => ({ LogsList: () => null }));
vi.mock("../restored-logs/restored-logs-panel", () => ({ RestoredLogsPanel: () => null }));

import { LogsViewerContext } from "../logs-viewer/logs-viewer";
import { LogsListHeader } from "./logs-header";

type Ctx = React.ContextType<typeof LogsViewerContext>;

const renderHeader = (ctx: Partial<Ctx> = {}) =>
  render(
    <LogsViewerContext.Provider
      value={{ tier: "hot", restoreRequestId: "", showAgent: true, ...ctx } as unknown as Ctx}
    >
      <LogsListHeader />
    </LogsViewerContext.Provider>,
  );

describe("LogsListHeader", () => {
  it("offers both service sources", () => {
    renderHeader();

    expect(screen.getByText("Managed Service")).toBeTruthy();
    expect(screen.getByText("My Service")).toBeTruthy();
  });

  it("offers the agent over live logs", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: /blocks agent/i })).toBeTruthy();
  });

  /**
   * The agent queries hot storage. Leaving the button on a restored view implies it can answer
   * about the restored window, and every answer it gave would be about different days.
   */
  it("withholds the agent over a restore, which it cannot query", () => {
    renderHeader({ tier: "cold", restoreRequestId: "req-1" } as Partial<Ctx>);

    expect(screen.queryByRole("button", { name: /blocks agent/i })).toBeNull();
  });

  it("withholds the agent on a restored tier even before the request has loaded", () => {
    renderHeader({ tier: "archive", restoreRequestId: "" } as Partial<Ctx>);

    expect(screen.queryByRole("button", { name: /blocks agent/i })).toBeNull();
  });

  /**
   * The tiers ride beside the service tabs as one switcher rather than a band of cards, and
   * each carries its blurb as a tooltip.
   */
  it("offers the storage tiers beside the service tabs when restores can be read", () => {
    renderHeader({ canSwitchTier: true } as Partial<Ctx>);

    expect(screen.getByRole("tab", { name: /hot/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /cold/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /archive/i })).toBeTruthy();
    // 4 === DOCUMENT_POSITION_FOLLOWING: the tiers sit after the source tabs, at the far end
    // of the same row.
    const sourceTab = screen.getByRole("tab", { name: "Managed Service" });
    expect(
      sourceTab.compareDocumentPosition(screen.getByRole("tab", { name: /hot/i })) & 4,
    ).toBeTruthy();
  });

  /** The per-service logs route reads no restores, so there is no other tier to move to. */
  it("withholds the tier switcher where there are no restores to read", () => {
    renderHeader();

    expect(screen.queryByRole("tab", { name: /archive/i })).toBeNull();
  });

  it("switches tier on a pick", async () => {
    const changeTier = vi.fn();
    renderHeader({ canSwitchTier: true, changeTier } as Partial<Ctx>);

    await userEvent.click(screen.getByRole("tab", { name: /cold/i }));

    expect(changeTier).toHaveBeenCalledWith("cold");
  });

  /** The Logs route hosts the agent in its own page header; offering it here too would double it. */
  it("withholds the agent when the page hosts it itself", () => {
    renderHeader({ showAgent: false } as Partial<Ctx>);

    expect(screen.queryByRole("button", { name: /blocks agent/i })).toBeNull();
  });
});
