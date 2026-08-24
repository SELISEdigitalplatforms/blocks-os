import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Service } from "./logs-viewer";

vi.mock("nuqs", async () => {
  const React = await import("react");
  return {
    useQueryState: (_key: string, opts?: { defaultValue?: string }) =>
      React.useState(opts?.defaultValue ?? ""),
  };
});

vi.mock("../logs-list", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("./logs-viewer")>("./logs-viewer");
  return {
    LogsList: () => {
      const ctx = React.useContext(actual.LogsViewerContext);
      return React.createElement(
        "div",
        { "data-testid": "logs-list" },
        `svc:${ctx.selectedService?.id ?? "none"}|names:${(ctx.selectedService?.serviceNames || []).join(",")}|src:${String(ctx.isSourceBlocks)}`,
      );
    },
  };
});

vi.mock("../logs-header/logs-header", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("./logs-viewer")>("./logs-viewer");
  return {
    LogsListHeader: () => {
      const ctx = React.useContext(actual.LogsViewerContext);
      return React.createElement(
        "div",
        null,
        React.createElement(
          "button",
          {
            onClick: () =>
              ctx.changeService({ id: "b", label: "B", serviceName: "b-api" }),
          },
          "change",
        ),
        React.createElement(
          "button",
          {
            onClick: () =>
              ctx.changeService(
                { id: "a", label: "A", serviceName: "a-api", serviceNames: ["a-api", "a-worker"] },
                "a-worker",
              ),
          },
          "narrow-to-worker",
        ),
        React.createElement(
          "button",
          {
            onClick: () =>
              ctx.changeService({
                id: "a",
                label: "A",
                serviceName: "a-api",
                serviceNames: ["a-api", "a-worker"],
              }),
          },
          "clear-narrowing",
        ),
      );
    },
  };
});

import { LogsViewer } from "./logs-viewer";

const services: Service[] = [
  {
    id: "a",
    label: "A",
    serviceName: "a-api",
    serviceNames: ["a-api", "a-worker"],
    components: [
      { label: "API", value: "a-api" },
      { label: "Worker", value: "a-worker" },
    ],
  },
  { id: "b", label: "B", serviceName: "b-api", serviceNames: ["b-api"] },
];

const line = () => screen.getByTestId("logs-list").textContent ?? "";

describe("LogsViewer", () => {
  it("selects the first service and shows all of its service names by default", () => {
    render(<LogsViewer services={services} />);
    expect(line()).toContain("svc:a");
    expect(line()).toContain("names:a-api,a-worker");
    expect(line()).toContain("src:true");
  });

  it("leaves service names untouched for non-blocks sources", () => {
    render(<LogsViewer services={services} isSourceBlocks={false} />);
    expect(line()).toContain("names:a-api,a-worker");
    expect(line()).toContain("src:false");
  });

  it("switches the selected service through the context", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    await user.click(screen.getByText("change"));
    expect(line()).toContain("svc:b");
    expect(line()).toContain("names:b-api");
  });

  it("narrows service names to a single component when one is selected", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    await user.click(screen.getByText("narrow-to-worker"));
    expect(line()).toContain("svc:a");
    expect(line()).toContain("names:a-worker");
  });

  it("reverts to the full service name list when narrowing is cleared", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    await user.click(screen.getByText("narrow-to-worker"));
    await user.click(screen.getByText("clear-narrowing"));
    expect(line()).toContain("names:a-api,a-worker");
  });

  it("renders no selected service when the list is empty", () => {
    render(<LogsViewer services={[]} />);
    expect(line()).toContain("svc:none");
  });
});
