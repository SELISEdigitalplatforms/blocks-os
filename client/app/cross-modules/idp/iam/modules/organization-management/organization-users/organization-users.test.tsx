import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, email: "", name: "" },
  getArgs: undefined as unknown,
  data: { data: [{ itemId: "u1" }], totalCount: 25 },
  isLoading: false,
  isFetching: false,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUsers: (args: unknown) => {
    h.getArgs = args;
    return { isLoading: h.isLoading, isFetching: h.isFetching, data: h.data };
  },
}));
vi.mock("./organization-users-table", () => ({
  OrganizationUsersTable: ({ users, isLoading }: { users: unknown[]; isLoading: boolean }) => (
    <div data-testid="table">{isLoading ? "loading" : `count:${users.length}`}</div>
  ),
}));
vi.mock("./organization-users-filter-toolbar", () => ({
  OrganizationUsersFilterToolbar: () => <div data-testid="toolbar" />,
  useOrganizationUsersFilterQueryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
  useOrganizationUsersSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
  }),
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({ onChange }: { onChange: (p: number) => void }) => (
    <button data-testid="page" onClick={() => onChange(3)}>
      page
    </button>
  ),
}));

import { OrganizationUsers } from "./organization-users";

describe("OrganizationUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.data = { data: [{ itemId: "u1" }], totalCount: 25 };
  });

  it("scopes the user query to the organization id", () => {
    render(<OrganizationUsers organizationId="org-9" />);
    expect(h.getArgs).toMatchObject({ filter: { organizationId: "org-9" }, projectKey: "tenant-1" });
  });

  it("renders the table and pagination", () => {
    render(<OrganizationUsers organizationId="org-9" />);
    expect(screen.getByTestId("table").textContent).toBe("count:1");
    expect(screen.getByTestId("page")).toBeTruthy();
  });

  it("changes the page through pagination", () => {
    render(<OrganizationUsers organizationId="org-9" />);
    fireEvent.click(screen.getByTestId("page"));
    expect((h.setQueryParams.mock.calls[0][0] as (p: object) => object)({})).toMatchObject({
      page: 3,
    });
  });
});
