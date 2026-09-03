import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ setQueryParams: vi.fn(), queryParams: {} as Record<string, string> }));

vi.mock("nuqs", () => ({
  parseAsArrayOf: () => ({ withDefault: (d: unknown) => ({ _d: d }) }),
  parseAsInteger: { withDefault: (d: unknown) => ({ _d: d }) },
  parseAsString: { withDefault: (d: unknown) => ({ _d: d }) },
  useQueryStates: () => [h.queryParams, h.setQueryParams],
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetAllEnabledOrganizations: () => ({
    data: [
      { itemId: "default", name: "Default" },
      { itemId: "org-1", name: "Acme" },
    ],
    isLoading: false,
  }),
  useGetOrganizationConfig: () => ({ data: { isMultiOrgEnabled: true } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoleFilterOptions: () => ({
    data: [
      { label: "Admin", value: "admin" },
      { label: "Auditor", value: "auditor" },
    ],
    isLoading: false,
  }),
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
      <button onClick={() => onChange("search", { selected: "email", value: "abc" })}>
        change-search
      </button>
      <button onClick={() => onChange("joinedOn", { from: new Date("2020-01-01"), to: undefined })}>
        change-date
      </button>
      <button onClick={() => onChange("organizationIds", ["org-1"])}>change-orgs</button>
      <button onClick={() => onChange("roles", ["admin"])}>change-roles</button>
      <button onClick={onReset}>reset</button>
    </div>
  ),
  useSortQueryParams: () => ({ sortQueryParams: {}, setSortQueryParams: vi.fn() }),
}));

import {
  UsersSearchFilter,
  UsersDateFilters,
  rangeToIso,
  isoToRange,
} from "./users-filter-toolbar";

beforeEach(() => {
  vi.clearAllMocks();
  h.queryParams = {
    "selected-filter": "name",
    name: "",
    email: "",
    organizationIds: [],
    roles: [],
  } as unknown as Record<string, string>;
});

describe("users-filter-toolbar helpers", () => {
  it("rangeToIso converts dates and strings to iso, undefined otherwise", () => {
    expect(rangeToIso(null)).toEqual({ from: undefined, to: undefined });
    const d = new Date("2021-05-01T00:00:00.000Z");
    expect(rangeToIso({ from: d, to: "2021-06-01" })).toEqual({
      from: d.toISOString(),
      to: "2021-06-01",
    });
  });

  it("isoToRange parses iso strings into Date objects", () => {
    const r = isoToRange("2021-05-01", "");
    expect(r.from).toBeInstanceOf(Date);
    expect(r.to).toBeUndefined();
  });
});

describe("UsersSearchFilter", () => {
  it("updates the query params when the search filter changes", () => {
    render(<UsersSearchFilter />);
    fireEvent.click(screen.getByText("change-search"));
    expect(h.setQueryParams).toHaveBeenCalled();
  });

  it("resets the query params", () => {
    render(<UsersSearchFilter />);
    fireEvent.click(screen.getByText("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });
});

describe("UsersDateFilters", () => {
  it("updates the range query params when a date filter changes", () => {
    render(<UsersDateFilters />);
    fireEvent.click(screen.getByText("change-date"));
    expect(h.setQueryParams).toHaveBeenCalled();
  });

  it("clears roles when the organization filter changes", () => {
    render(<UsersDateFilters />);
    fireEvent.click(screen.getByText("change-orgs"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ roles: ["admin"], page: 2 })).toEqual({
      roles: [],
      page: 0,
      organizationIds: ["org-1"],
    });
  });

  it("updates roles without changing organizations", () => {
    render(<UsersDateFilters />);
    fireEvent.click(screen.getByText("change-roles"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ organizationIds: ["org-1"] })).toEqual({
      organizationIds: ["org-1"],
      roles: ["admin"],
      page: 0,
    });
  });

  it("resets the date query params", () => {
    render(<UsersDateFilters />);
    fireEvent.click(screen.getByText("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });
});
