import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => "/app/proj/lmt" }));
// Standalone context to avoid importing the heavy logs-viewer module tree.
vi.mock("../logs-viewer/logs-viewer", async () => {
  const react = await import("react");
  return { LogsViewerContext: react.createContext({}) };
});

import { LogItem } from "./log-item";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";

type Ctx = React.ContextType<typeof LogsViewerContext>;

const renderItem = (log: Record<string, unknown>, ctx: Partial<Ctx> = {}) =>
  render(
    <MemoryRouter>
      <LogsViewerContext.Provider
        value={
          {
            logsRouteServiceName: "iam",
            selectedService: { serviceName: "iam" },
            useGenericTraceLinks: true,
            isSourceBlocks: true,
            services: [],
            ...ctx,
          } as Ctx
        }
      >
        <LogItem log={log as never} />
      </LogsViewerContext.Provider>
    </MemoryRouter>,
  );

describe("LogItem", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("renders the level, message and a generic trace link", () => {
    renderItem({
      traceId: "trace-1",
      level: "error",
      message: "Something failed",
      serviceName: "blocks-iam-api",
      timestamp: "2024-01-01T00:00:00Z",
    });
    expect(screen.getByText("error")).toBeTruthy();
    expect(screen.getByText("Something failed")).toBeTruthy();
    const link = screen.getByRole("link", { name: /View trace details/ }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/app/proj/lmt/tracing/trace-1");
  });

  it("formats a blocks service badge by stripping the blocks prefix", () => {
    renderItem({
      traceId: "t",
      level: "info",
      message: "m",
      serviceName: "blocks-iam-worker",
      timestamp: "2024-01-01T00:00:00Z",
    });
    expect(screen.getByText("iam-worker")).toBeTruthy();
  });

  it("resolves a managed service badge to its raw name", () => {
    renderItem(
      {
        traceId: "t",
        level: "info",
        message: "m",
        serviceName: "svc-123",
        timestamp: "2024-01-01T00:00:00Z",
      },
      {
        isSourceBlocks: false,
        services: [{ serviceName: "svc-123", _raw: { name: "Orders Service" } }] as never,
      },
    );
    expect(screen.getByText("Orders Service")).toBeTruthy();
  });

  it("renders a plain trace label when there is no trace href", () => {
    renderItem(
      {
        traceId: "trace-9",
        level: "warn",
        message: "m",
        serviceName: "blocks-iam",
        timestamp: "2024-01-01T00:00:00Z",
      },
      { useGenericTraceLinks: false, logsRouteServiceName: "" },
    );
    // No href resolvable -> the trace id is shown as plain text, not a link.
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("[trace-9]")).toBeTruthy();
  });
});
