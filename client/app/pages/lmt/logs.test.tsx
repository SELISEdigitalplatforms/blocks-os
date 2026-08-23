import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  source: "blocks",
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  blocksServicesData: [
    { key: "os", label: "OS", sortOrder: 1, apiServiceName: "blocks-os", workerServiceNames: ["blocks-os-worker"] },
  ] as unknown,
  isBlocksServicesLoading: false,
  viewerProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@blocks-identifier/hooks/use-services", () => ({
  useGetAllServices: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("@blocks-lmt/hooks/use-log", () => ({
  useGetBlocksServices: () => ({
    data: h.blocksServicesData,
    isLoading: h.isBlocksServicesLoading,
  }),
}));
vi.mock("@blocks-lmt/components", () => ({
  LogsViewer: (props: Record<string, unknown>) => {
    h.viewerProps = props;
    return (
      <div data-testid="logs-viewer">
        <span data-testid="service-count">{(props.services as unknown[]).length}</span>
        <span data-testid="services-loading">{String(props.isServicesLoading)}</span>
        <span data-testid="is-blocks">{String(props.isSourceBlocks)}</span>
      </div>
    );
  },
}));
vi.mock("nuqs", () => ({
  createParser: () => ({ withDefault: (d: unknown) => ({ defaultValue: d }) }),
  useQueryState: (_k: string, opts: { defaultValue: unknown }) => [h.source ?? opts.defaultValue],
}));

import { LogsRoute } from "./logs";

describe("LogsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.source = "blocks";
    h.data = { data: [] };
    h.isLoading = false;
    h.isFetching = false;
    h.blocksServicesData = [
      {
        key: "os",
        label: "OS",
        sortOrder: 1,
        apiServiceName: "blocks-os",
        workerServiceNames: ["blocks-os-worker"],
      },
    ];
    h.isBlocksServicesLoading = false;
  });

  it("renders the blocks services source by default", () => {
    render(<LogsRoute />);
    expect(screen.getByTestId("logs-viewer")).toBeTruthy();
    expect(screen.getByTestId("is-blocks").textContent).toBe("true");
    // Blocks source uses the fetched blocks service list (non-empty).
    expect(Number(screen.getByTestId("service-count").textContent)).toBeGreaterThan(0);
  });

  it("maps managed services from the fetched data", () => {
    h.source = "managed";
    h.data = { data: [{ serviceId: "svc-1", name: "Orders" }] };
    render(<LogsRoute />);
    expect(screen.getByTestId("is-blocks").textContent).toBe("false");
    expect(screen.getByTestId("service-count").textContent).toBe("1");
  });

  it("marks services loading while managed services are being fetched", () => {
    h.source = "managed";
    h.isLoading = true;
    render(<LogsRoute />);
    expect(screen.getByTestId("services-loading").textContent).toBe("true");
  });

  it("marks services loading while blocks services are being fetched", () => {
    h.source = "blocks";
    h.isBlocksServicesLoading = true;
    render(<LogsRoute />);
    expect(screen.getByTestId("services-loading").textContent).toBe("true");
  });
});
