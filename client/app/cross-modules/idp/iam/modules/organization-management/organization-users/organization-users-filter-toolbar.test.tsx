import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: {} as Record<string, string>,
}));

vi.mock("nuqs", () => ({
  parseAsArrayOf: () => ({ withDefault: (d: unknown) => ({ _d: d }) }),
  parseAsInteger: { withDefault: (d: unknown) => ({ _d: d }) },
  parseAsString: { withDefault: (d: unknown) => ({ _d: d }) },
  useQueryStates: () => [h.queryParams, h.setQueryParams],
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoleFilterOptions: () => ({ data: [{ label: "Admin", value: "admin" }], isLoading: false }),
}));
vi.mock("@/components/filter-toolbar", () => ({
  FilterToolbar: ({
    onChange,
    onReset,
  }: {
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
  }) => (
    <div>
      <button onClick={() => onChange("search", { selected: "name", value: "abc" })}>
        change-name
      </button>
      <button onClick={() => onChange("search", { selected: "email", value: "a@b.co" })}>
        change-email
      </button>
      <button onClick={() => onChange("roles", ["admin"])}>change-roles</button>
      <button onClick={() => onChange("other", "x")}>change-other</button>
      <button onClick={onReset}>reset</button>
    </div>
  ),
  useSortQueryParams: () => ({ sortQueryParams: {}, setSortQueryParams: vi.fn() }),
}));

import { OrganizationUsersFilterToolbar } from "./organization-users-filter-toolbar";

beforeEach(() => {
  vi.clearAllMocks();
  h.queryParams = {
    "selected-filter": "name",
    name: "",
    email: "",
    roles: [],
  } as unknown as Record<string, string>;
});

describe("OrganizationUsersFilterToolbar", () => {
  it("maps a name search into the name query param", () => {
    render(<OrganizationUsersFilterToolbar organizationId="org-1" />);
    fireEvent.click(screen.getByText("change-name"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toEqual({
      "selected-filter": "name",
      name: "abc",
      email: "",
      page: 0,
    });
  });

  it("maps an email search into the email query param", () => {
    render(<OrganizationUsersFilterToolbar organizationId="org-1" />);
    fireEvent.click(screen.getByText("change-email"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toEqual({
      "selected-filter": "email",
      name: "",
      email: "a@b.co",
      page: 0,
    });
  });

  it("handles non-search keys generically", () => {
    render(<OrganizationUsersFilterToolbar organizationId="org-1" />);
    fireEvent.click(screen.getByText("change-other"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toEqual({ other: "x", page: 0 });
  });

  it("resets all query params", () => {
    render(<OrganizationUsersFilterToolbar organizationId="org-1" />);
    fireEvent.click(screen.getByText("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });

  it("updates selected roles", () => {
    render(<OrganizationUsersFilterToolbar organizationId="org-1" />);
    fireEvent.click(screen.getByText("change-roles"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toEqual({ roles: ["admin"], page: 0 });
  });
});
