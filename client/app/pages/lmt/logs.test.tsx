import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  source: "blocks",
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  viewerProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@blocks-identifier/hooks/use-services", () => ({
  useGetAllServices: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("@blocks-lmt/components", () => ({
  LogsViewer: (props: Record<string, unknown>) => {
    h.viewerProps = props;
    return (
      <div data-testid="logs-viewer">
        <span data-testid="service-count">{(props.services as unknown[]).length}</span>
        <span data-testid="managed-loading">{String(props.isManagedLoading)}</span>
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
  });

  it("renders the blocks services source by default", () => {
    render(<LogsRoute />);
    expect(screen.getByTestId("logs-viewer")).toBeTruthy();
    expect(screen.getByTestId("is-blocks").textContent).toBe("true");
    // Blocks source uses the predefined blocks service list (non-empty).
    expect(Number(screen.getByTestId("service-count").textContent)).toBeGreaterThan(0);
  });

  it("maps managed services from the fetched data", () => {
    h.source = "managed";
    h.data = { data: [{ serviceId: "svc-1", name: "Orders" }] };
    render(<LogsRoute />);
    expect(screen.getByTestId("is-blocks").textContent).toBe("false");
    expect(screen.getByTestId("service-count").textContent).toBe("1");
  });

  it("marks managed loading while services are being fetched", () => {
    h.source = "managed";
    h.isLoading = true;
    render(<LogsRoute />);
    expect(screen.getByTestId("managed-loading").textContent).toBe("true");
  });
});
