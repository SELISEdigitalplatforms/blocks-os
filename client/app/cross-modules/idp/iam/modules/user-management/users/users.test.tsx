import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, email: "", name: "" },
  data: { data: [{ itemId: "u1" }], totalCount: 25 },
  isLoading: false,
  isFetching: false,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUsers: () => ({ isLoading: h.isLoading, isFetching: h.isFetching, data: h.data }),
}));
vi.mock("./users-table", () => ({
  UsersTable: ({ users, isLoading }: { users: unknown[]; isLoading: boolean }) => (
    <div data-testid="table">{isLoading ? "loading" : `count:${users.length}`}</div>
  ),
}));
vi.mock("./users-filter-toolbar", () => ({
  UsersFilterToolbar: () => <div data-testid="toolbar" />,
  useUsersFilterQueryParams: () => ({ queryParams: h.queryParams, setQueryParams: h.setQueryParams }),
  useUsersSortQueryParams: () => ({ sortQueryParams: { property: "Name", isDescending: false } }),
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({ onChange }: { onChange: (p: number) => void }) => (
    <button data-testid="page" onClick={() => onChange(2)}>
      page
    </button>
  ),
}));

import { Users } from "./users";

describe("Users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.data = { data: [{ itemId: "u1" }], totalCount: 25 };
  });

  it("renders the users table and pagination", () => {
    render(<Users />);
    expect(screen.getByTestId("table").textContent).toBe("count:1");
    expect(screen.getByTestId("page")).toBeTruthy();
  });

  it("hides pagination while loading", () => {
    h.isLoading = true;
    render(<Users />);
    expect(screen.getByTestId("table").textContent).toBe("loading");
    expect(screen.queryByTestId("page")).toBeNull();
  });

  it("changes the page through pagination", () => {
    render(<Users />);
    fireEvent.click(screen.getByTestId("page"));
    expect((h.setQueryParams.mock.calls[0][0] as (p: object) => object)({})).toMatchObject({
      page: 2,
    });
  });
});
