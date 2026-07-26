import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, search: "", isBuiltIn: "", type: "1", permissionSeverity: "" },
  getArgs: undefined as unknown,
  data: { data: [{ itemId: "p1" }, { itemId: "p2" }], totalCount: 2 },
  isLoading: false,
  isFetching: false,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: (args: unknown) => {
    h.getArgs = args;
    return { isLoading: h.isLoading, isFetching: h.isFetching, data: h.data };
  },
}));
vi.mock("./permissions-list", () => ({
  PermissionsList: ({ permissions, isLoading }: { permissions: unknown[]; isLoading: boolean }) => (
    <div data-testid="list">{isLoading ? "loading" : `count:${permissions.length}`}</div>
  ),
}));
vi.mock("./permissions-group-severity", () => ({
  PermissionsGroupBySeverity: () => <div data-testid="group-severity" />,
}));
vi.mock("./permissions-filter-toolbar", () => ({
  PermissionsFilterToolbar: () => <div data-testid="toolbar" />,
  usePermissionsFilterQuaryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
  usePermissionsSortQuaryParams: () => ({ sortQueryParams: { property: "Name", isDescending: false } }),
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({
    onChange,
    onPageSizeChange,
  }: {
    onChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
  }) => (
    <div>
      <button data-testid="page" onClick={() => onChange(2)}>
        page
      </button>
      <button data-testid="size" onClick={() => onPageSizeChange(20)}>
        size
      </button>
    </div>
  ),
}));

import { Permissions } from "./permissions";

describe("Permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.queryParams = {
      page: 0,
      pageSize: 10,
      search: "",
      isBuiltIn: "",
      type: "1",
      permissionSeverity: "",
    };
  });

  it("renders the permissions list and pagination when loaded", () => {
    render(<Permissions />);
    expect(screen.getByTestId("list").textContent).toBe("count:2");
    expect(screen.getByTestId("page")).toBeTruthy();
  });

  it("hides pagination while loading", () => {
    h.isLoading = true;
    render(<Permissions />);
    expect(screen.getByTestId("list").textContent).toBe("loading");
    expect(screen.queryByTestId("page")).toBeNull();
  });

  it("maps the built-in filter value passed to the query", () => {
    h.queryParams = { ...h.queryParams, isBuiltIn: "yes" };
    render(<Permissions />);
    expect(h.getArgs).toMatchObject({ isBuiltIn: "yes", projectKey: "tenant-1", type: 1 });
  });

  it("updates the page and page size through pagination handlers", () => {
    render(<Permissions />);
    fireEvent.click(screen.getByTestId("page"));
    expect((h.setQueryParams.mock.calls[0][0] as (p: object) => object)({})).toMatchObject({
      page: 2,
    });
    fireEvent.click(screen.getByTestId("size"));
    expect((h.setQueryParams.mock.calls[1][0] as (p: object) => object)({})).toMatchObject({
      pageSize: 20,
      page: 0,
    });
  });
});
