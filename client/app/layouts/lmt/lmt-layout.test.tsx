import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  pathname: "/app/lmt/usage",
  basePath: "/app/lmt",
  refetch: vi.fn(),
  isLoading: false,
  isFetching: false,
}));

vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: h.pathname }),
  Outlet: () => <div data-testid="outlet" />,
}));
vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => h.basePath }));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-lmt/hooks/use-usage", () => ({
  useUsagesMetrics: () => ({ isLoading: h.isLoading, isFetching: h.isFetching, refetch: h.refetch }),
}));
vi.mock("nuqs", () => ({
  parseAsString: { withDefault: (d: unknown) => ({ defaultValue: d }) },
  useQueryState: () => ["1h", vi.fn()],
}));

import LmtLayout from "./lmt-layout";

describe("LmtLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pathname = "/app/lmt/usage";
    h.isLoading = false;
    h.isFetching = false;
  });

  it("renders the usage page header with refresh actions", () => {
    render(<LmtLayout />);
    expect(screen.getByText("Usage")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Refresh/ })).toBeTruthy();
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("refetches usage metrics when refresh is clicked", async () => {
    const user = userEvent.setup();
    render(<LmtLayout />);
    await user.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("hides the header on a logs detail route", () => {
    h.pathname = "/app/lmt/logs/iam";
    render(<LmtLayout />);
    expect(screen.queryByText("Usage")).toBeNull();
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("omits the usage actions on the tracing route", () => {
    h.pathname = "/app/lmt/tracing";
    render(<LmtLayout />);
    expect(screen.queryByRole("button", { name: /Refresh/ })).toBeNull();
  });
});
