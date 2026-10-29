import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// Hoisted alongside the vi.mock factories below, which are lifted above this file's body.
// Dates are built from local parts so the formatted expectations hold in any timezone.
const h = vi.hoisted(() => ({
  trace: {
    traceId: "615237913d704664bba44f9ca704acb2",
    spanId: "d3c8e161bc5368fc",
    parentId: "",
    kind: "Server",
    serviceName: "blocks-os",
    duration: 16815.13,
    startTime: new Date(2026, 8, 8, 18, 19),
    endTime: new Date(2026, 8, 8, 18, 35),
    entryPoint: { method: "GET", actionName: "api/LogAndTraceRestore/GetRequestId" },
    attributes: { "response.status.code": 500 },
    status: "",
  },
}));

// The ruler draws its own ticks and is covered separately; only the rows are under test.
vi.mock("../annotation-bar/annotation-bar", () => ({ default: () => null }));
vi.mock("@/components/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Standalone context: the real trace-details module pulls in the whole timeline tree.
vi.mock("../trace-details", async () => {
  const react = await import("react");
  return { timelineContext: react.createContext({ selectedTrace: h.trace }) };
});

import { TracingInfo } from "./tracing-info";

const openAnnotation = async () => {
  const user = userEvent.setup();
  render(<TracingInfo />);
  await user.click(screen.getByRole("button", { name: /Annotation/i }));
};

describe("TracingInfo annotations", () => {
  it("names the closing annotation's timestamp for the end of the span", async () => {
    await openAnnotation();

    // Both rows previously read "Start time", so the finish row appeared to repeat the start.
    expect(screen.getByText("End time")).toBeTruthy();
    expect(screen.getAllByText("Start time")).toHaveLength(1);
  });

  it("pairs each annotation timestamp with the end of the span it describes", async () => {
    await openAnnotation();

    const startField = screen.getByText("Start time").parentElement;
    const endField = screen.getByText("End time").parentElement;

    expect(startField?.textContent).toContain("08/09/2026, 18:19");
    expect(endField?.textContent).toContain("08/09/2026, 18:35");
  });
});
