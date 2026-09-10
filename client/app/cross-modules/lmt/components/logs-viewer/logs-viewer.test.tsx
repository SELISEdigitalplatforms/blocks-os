import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Service } from "./logs-viewer";

vi.mock("nuqs", async () => {
  const React = await import("react");
  return {
    useQueryState: (key: string, opts?: { defaultValue?: string }) => {
      hoistedKeys.keys.add(key);
      return React.useState(opts?.defaultValue ?? "");
    },
  };
});

const hoistedKeys = vi.hoisted(() => ({ keys: new Set<string>() }));

const h = vi.hoisted(() => ({ listMounts: 0, restore: {} as Record<string, unknown> }));

vi.mock("@seliseblocks/genesis-os/hooks", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useIsMobile: () => false };
});

vi.mock("@blocks-lmt/hooks/use-restore-request", () => ({
  NO_RESTORE_REQUEST: "NoRequest",
  useRestoreRequest: () => h.restore,
}));

vi.mock("../restored-logs/restored-logs-panel", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("./logs-viewer")>("./logs-viewer");
  return {
    RestoredLogsPanel: ({ sourceType }: { sourceType: string }) => {
      const ctx = React.useContext(actual.LogsViewerContext);
      return React.createElement(
        "div",
        { "data-testid": "restored-logs" },
        `tier:${ctx.tier}|source:${sourceType}|req:${ctx.restoreRequestId}|range:${ctx.filter?.range ?? ""}|window:${ctx.restoreWindow?.startDate ?? ""}`,
      );
    },
  };
});

vi.mock("../logs-list", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("./logs-viewer")>("./logs-viewer");
  return {
    LogsList: () => {
      const ctx = React.useContext(actual.LogsViewerContext);
      // The filter toolbar lives inside LogsList, so a remount here would close an
      // open filter popover; the count guards against that.
      React.useEffect(() => {
        h.listMounts += 1;
      }, []);
      return React.createElement(
        "div",
        { "data-testid": "logs-list" },
        `svc:${ctx.selectedService?.id ?? "none"}|names:${(ctx.selectedService?.serviceNames || []).join(",")}|svcs:${ctx.selectedServices.map((s) => s.id).join(",")}|all:${ctx.selectedServiceNames.join(",")}|src:${String(ctx.isSourceBlocks)}`,
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
            onClick: () => ctx.changeService({ id: "b", label: "B", serviceName: "b-api" }),
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
        React.createElement(
          "button",
          { onClick: () => ctx.changeServices(["a::a-worker", "b"]) },
          "select-two-services",
        ),
        React.createElement("button", { onClick: () => ctx.changeServices([]) }, "clear-services"),
        React.createElement(
          "button",
          { onClick: () => ctx.changeServices(["gone", "b"]) },
          "select-unknown-service",
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
  beforeEach(() => {
    h.listMounts = 0;
  });

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

  it("selects components across several services at once", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    await user.click(screen.getByText("select-two-services"));
    expect(line()).toContain("svcs:a,b");
    expect(line()).toContain("all:a-worker,b-api");
  });

  it("keeps the first service selected when the selection is cleared", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    await user.click(screen.getByText("select-two-services"));
    await user.click(screen.getByText("clear-services"));
    expect(line()).toContain("svcs:a");
    expect(line()).toContain("all:a-api,a-worker");
  });

  it("ignores selected services that are not registered", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    await user.click(screen.getByText("select-unknown-service"));
    expect(line()).toContain("svcs:b");
    expect(line()).toContain("all:b-api");
  });

  it("keeps the logs list mounted while the service selection changes", async () => {
    const user = userEvent.setup();
    render(<LogsViewer services={services} />);
    expect(h.listMounts).toBe(1);

    await user.click(screen.getByText("select-two-services"));
    await user.click(screen.getByText("narrow-to-worker"));

    expect(line()).toContain("svcs:a");
    // A remount would tear down the filter popover the user is still clicking in.
    expect(h.listMounts).toBe(1);
  });

  it("renders no selected service when the list is empty", () => {
    render(<LogsViewer services={[]} />);
    expect(line()).toContain("svc:none");
  });

  /**
   * Tier is the outer choice and the service source sits inside it: a reader switches storage
   * tier far less often than they switch between managed and their own services.
   */
  describe("storage tiers", () => {
    const pickTier = async (name: RegExp) => {
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name }));
    };

    beforeEach(() => {
      h.restore = {
        requestId: "req-1",
        status: "Completed",
        isLoading: false,
        totalFiles: 14,
        processedFiles: 14,
        failedFiles: 0,
        startDate: "2026-08-01T00:00:00Z",
        endDate: "2026-08-07T00:00:00Z",
        logRowsRestored: 12480,
        refresh: vi.fn(),
      };
    });

    it("opens on the live logs", () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);

      expect(screen.getByTestId("logs-list")).toBeTruthy();
      expect(screen.queryByTestId("restored-logs")).toBeNull();
    });

    it("offers every tier", () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);

      expect(screen.getByRole("button", { name: /hot/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /cold/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /archive/i })).toBeTruthy();
    });

    it("puts the tier choice above the service source tabs", () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);

      const tier = screen.getByRole("button", { name: /hot/i });
      const sourceTab = screen.getByText("change");
      // 4 === DOCUMENT_POSITION_FOLLOWING: the tabs come after the tier cards.
      expect(tier.compareDocumentPosition(sourceTab) & 4).toBeTruthy();
    });

    it("reads the restored rows once a cold tier is picked", async () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);
      await pickTier(/cold/i);

      expect(screen.getByTestId("restored-logs").textContent).toContain("source:Cold");
      expect(screen.queryByTestId("logs-list")).toBeNull();
    });

    it("reads the archive tier when that is picked", async () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);
      await pickTier(/archive/i);

      expect(screen.getByTestId("restored-logs").textContent).toContain("source:Archive");
    });

    /**
     * The live default is the last 30 minutes. Carried onto a restore of month-old days it
     * matches nothing at all, which a reader would read as an empty restore.
     */
    it("drops the live relative window when reading a restore", async () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);
      await pickTier(/cold/i);

      expect(screen.getByTestId("restored-logs").textContent).toContain("range:|");
    });

    it("publishes the restore and its window, so rows and filters can use them", async () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);
      await pickTier(/cold/i);

      const line = screen.getByTestId("restored-logs").textContent ?? "";
      expect(line).toContain("req:req-1");
      expect(line).toContain("window:2026-08-01T00:00:00Z");
    });

    it("returns to the live logs, and to their default window, on the way back", async () => {
      render(<LogsViewer services={services} projectKey="proj-1" />);
      await pickTier(/cold/i);
      await pickTier(/hot/i);

      expect(screen.getByTestId("logs-list")).toBeTruthy();
      expect(screen.queryByTestId("restored-logs")).toBeNull();
    });

    it("keeps the chosen services while the tier changes", async () => {
      const user = userEvent.setup();
      render(<LogsViewer services={services} projectKey="proj-1" />);
      await user.click(screen.getByText("select-two-services"));
      await pickTier(/cold/i);
      await pickTier(/hot/i);

      expect(line()).toContain("all:a-worker,b-api");
    });

    /**
     * The per-service logs route has no project behind it, so no restore can ever be looked up
     * there. Offering the tiers anyway would give the reader two cards that lead nowhere.
     */
    it("offers no tier choice where no restore can be read", () => {
      render(<LogsViewer services={services} />);

      expect(screen.queryByRole("button", { name: /cold/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /archive/i })).toBeNull();
      expect(screen.getByTestId("logs-list")).toBeTruthy();
    });

    /**
     * "tab" already means the service tab on the per-service logs route, and log rows copy it
     * onto their trace links. The tier travels under its own name so it cannot end up there.
     */
    it("keeps the tier out of the param the trace links carry", () => {
      hoistedKeys.keys.clear();
      render(<LogsViewer services={services} projectKey="proj-1" />);

      expect(hoistedKeys.keys.has("tier")).toBe(true);
      expect(hoistedKeys.keys.has("tab")).toBe(false);
    });
  });
});
