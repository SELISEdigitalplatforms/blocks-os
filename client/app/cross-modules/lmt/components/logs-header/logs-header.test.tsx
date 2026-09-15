import { render, screen } from "@testing-library/react";
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
  LMTQueryAgentSheet: () => <button type="button">Ask AI</button>,
}));

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
      value={{ tier: "hot", restoreRequestId: "", ...ctx } as unknown as Ctx}
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

    expect(screen.getByRole("button", { name: /ask ai/i })).toBeTruthy();
  });

  /**
   * The agent queries hot storage. Leaving the button on a restored view implies it can answer
   * about the restored window, and every answer it gave would be about different days.
   */
  it("withholds the agent over a restore, which it cannot query", () => {
    renderHeader({ tier: "cold", restoreRequestId: "req-1" } as Partial<Ctx>);

    expect(screen.queryByRole("button", { name: /ask ai/i })).toBeNull();
  });

  it("withholds the agent on a restored tier even before the request has loaded", () => {
    renderHeader({ tier: "archive", restoreRequestId: "" } as Partial<Ctx>);

    expect(screen.queryByRole("button", { name: /ask ai/i })).toBeNull();
  });
});
