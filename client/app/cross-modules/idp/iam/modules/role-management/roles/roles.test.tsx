import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, search: "" },
  data: { data: [{ itemId: "r1" }, { itemId: "r2" }], totalCount: 25 },
  isLoading: false,
  isFetching: false,
  isMultiOrgEnabled: false,
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationConfig: () => ({ data: { isMultiOrgEnabled: h.isMultiOrgEnabled } }),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("./roles-list", () => ({
  RolesList: ({
    roles,
    isLoading,
    showDefaultOriginBadge,
  }: {
    roles: unknown[];
    isLoading: boolean;
    showDefaultOriginBadge?: boolean;
  }) => (
    <div data-testid="list" data-badge={String(showDefaultOriginBadge ?? false)}>
      {isLoading ? "loading" : `count:${roles.length}`}
    </div>
  ),
}));
vi.mock("./roles-filter-toolbar", () => ({
  RolesFilterToolBar: () => <div data-testid="toolbar" />,
  useRolesFilterQueryParams: () => ({ queryParams: h.queryParams, setQueryParams: h.setQueryParams }),
  useRolesSortQueryParams: () => ({ sortQueryParams: { property: "Name", isDescending: false } }),
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({ onChange }: { onChange: (p: number) => void }) => (
    <button data-testid="page" onClick={() => onChange(4)}>
      page
    </button>
  ),
}));

import { Roles } from "./roles";

describe("Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.data = { data: [{ itemId: "r1" }, { itemId: "r2" }], totalCount: 25 };
  });

  it("renders the roles list and pagination", () => {
    render(<Roles />);
    expect(screen.getByTestId("list").textContent).toBe("count:2");
    expect(screen.getByTestId("page")).toBeTruthy();
  });

  it("hides pagination while fetching", () => {
    h.isFetching = true;
    render(<Roles />);
    expect(screen.getByTestId("list").textContent).toBe("loading");
    expect(screen.queryByTestId("page")).toBeNull();
  });

  it("hides pagination when the total fits on one page", () => {
    h.data = { data: [{ itemId: "r1" }], totalCount: 5 };
    render(<Roles />);
    expect(screen.queryByTestId("page")).toBeNull();
  });

  it("changes the page through pagination", () => {
    render(<Roles />);
    fireEvent.click(screen.getByTestId("page"));
    expect((h.setQueryParams.mock.calls[0][0] as (p: object) => object)({})).toMatchObject({
      page: 4,
    });
  });
});
