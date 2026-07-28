import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { page: 0, pageSize: 10, search: "" },
  data: { organizations: [{ itemId: "o1" }], totalCount: 25 },
  orgConfig: { isMultiOrgEnabled: true, allowCreationFromCloud: true },
  isLoading: false,
  isFetching: false,
  addDisabled: undefined as unknown,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizations: () => ({ isLoading: h.isLoading, isFetching: h.isFetching, data: h.data }),
  useGetOrganizationConfig: () => ({ data: h.orgConfig }),
}));
vi.mock("./organizations-list", () => ({
  OrganizationsList: ({ organizations, isLoading }: { organizations: unknown[]; isLoading: boolean }) => (
    <div data-testid="list">{isLoading ? "loading" : `count:${organizations.length}`}</div>
  ),
}));
vi.mock("../add-organization/add-organization", () => ({
  AddOrganization: ({ disabled }: { disabled: boolean }) => {
    h.addDisabled = disabled;
    return <div data-testid="add">{String(disabled)}</div>;
  },
}));
vi.mock("./organizations-filter-toolbar", () => ({
  OrganizationsFilterToolbar: () => <div data-testid="toolbar" />,
  useOrganizationsFilterQueryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
  useOrganizationsSortQueryParams: () => ({ sortQueryParams: { property: "Name", isDescending: false } }),
}));
vi.mock("@/components/ui-kits/pagination/pagination", () => ({
  Pagination: ({ onChange }: { onChange: (p: number) => void }) => (
    <button data-testid="page" onClick={() => onChange(3)}>
      page
    </button>
  ),
}));

import { Organizations } from "./organizations";

describe("Organizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.orgConfig = { isMultiOrgEnabled: true, allowCreationFromCloud: true };
    h.data = { organizations: [{ itemId: "o1" }], totalCount: 25 };
  });

  it("renders the list and pagination when totalCount exceeds the page size", () => {
    render(<Organizations />);
    expect(screen.getByTestId("list").textContent).toBe("count:1");
    expect(screen.getByTestId("page")).toBeTruthy();
  });

  it("enables adding when multi-org creation is allowed", () => {
    render(<Organizations />);
    expect(screen.getByTestId("add").textContent).toBe("false");
  });

  it("disables adding when the org config forbids cloud creation", () => {
    h.orgConfig = { isMultiOrgEnabled: true, allowCreationFromCloud: false };
    render(<Organizations />);
    expect(screen.getByTestId("add").textContent).toBe("true");
  });

  it("hides pagination when the total fits in one page", () => {
    h.data = { organizations: [{ itemId: "o1" }], totalCount: 5 };
    render(<Organizations />);
    expect(screen.queryByTestId("page")).toBeNull();
  });

  it("updates the page through the pagination handler", () => {
    render(<Organizations />);
    fireEvent.click(screen.getByTestId("page"));
    expect((h.setQueryParams.mock.calls[0][0] as (p: object) => object)({})).toMatchObject({
      page: 3,
    });
  });
});
