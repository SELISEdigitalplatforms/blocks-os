import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./people-filter-toolbar", () => ({
  usePeopleFilterQueryParams: () => ({
    queryParams: { page: 0, pageSize: 10, search: "" },
    setQueryParams: vi.fn(),
  }),
  PeopleFilterToolbar: () => <div>filter toolbar</div>,
}));

vi.mock("./people-table", () => ({
  PeopleTable: ({ people }: { people: unknown[] }) => (
    <div data-testid="people-table">rows:{people.length}</div>
  ),
}));

vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: () => <div data-testid="pagination">pagination</div>,
}));

import { PeopleList } from "./people-list";

type PeopleData = { peoples: unknown[]; totalCount: number; isOwner: boolean };

const renderList = (data: PeopleData | undefined, isPeopleLoading = false) =>
  render(
    <PeopleList
      data={data as never}
      isPeopleLoading={isPeopleLoading}
      page={0}
      pageSize={10}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />,
  );

describe("PeopleList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pagination when there is loaded, non-empty data", () => {
    renderList({
      peoples: [{ id: "a" }, { id: "b" }],
      totalCount: 2,
      isOwner: false,
    });
    expect(screen.getByTestId("people-table").textContent).toContain("rows:2");
    expect(screen.getByTestId("pagination")).toBeTruthy();
  });

  it("hides pagination when the list is empty", () => {
    renderList({ peoples: [], totalCount: 0, isOwner: false });
    expect(screen.queryByTestId("pagination")).toBeNull();
  });

  it("hides pagination while loading even if data exists", () => {
    renderList({ peoples: [{ id: "a" }], totalCount: 1, isOwner: false }, true);
    expect(screen.queryByTestId("pagination")).toBeNull();
  });
});
