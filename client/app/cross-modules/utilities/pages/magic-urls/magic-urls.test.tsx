import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, search: "" },
  data: { configurations: [{ itemId: "m1" }], totalCount: 1 },
  isLoading: false,
  isFetching: false,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-utilities/hooks/use-magic-url-config", () => ({
  useGetMagicUrlConfigs: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("./magic-urls-list", () => ({
  MagicUrlsList: ({ configurations }: { configurations: unknown[] }) => (
    <div data-testid="list">count:{configurations.length}</div>
  ),
}));
vi.mock("./magic-urls-filter-toolbar", () => ({
  MagicUrlsFilterToolBar: () => <div data-testid="toolbar" />,
  useMagicUrlsFilterQueryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({ onChange }: { onChange: (p: number) => void }) => (
    <button data-testid="page" onClick={() => onChange(2)}>
      page
    </button>
  ),
}));

import { MagicUrls } from "./magic-urls";

describe("MagicUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.data = { configurations: [{ itemId: "m1" }], totalCount: 1 };
  });

  it("renders the list and pagination when configurations exist", () => {
    render(<MagicUrls />);
    expect(screen.getByTestId("list").textContent).toBe("count:1");
    expect(screen.getByTestId("page")).toBeTruthy();
  });

  it("renders the empty state when there are no configurations", () => {
    h.data = { configurations: [], totalCount: 0 };
    render(<MagicUrls />);
    expect(screen.getByText("No configurations found")).toBeTruthy();
    expect(screen.queryByTestId("list")).toBeNull();
  });

  it("changes the page through the pagination handler", () => {
    render(<MagicUrls />);
    fireEvent.click(screen.getByTestId("page"));
    expect((h.setQueryParams.mock.calls[0][0] as (p: object) => object)({})).toMatchObject({
      page: 2,
    });
  });
});
