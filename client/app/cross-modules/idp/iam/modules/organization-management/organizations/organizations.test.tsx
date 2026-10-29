import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  orgsResult: {} as Record<string, unknown>,
  configResult: {} as Record<string, unknown>,
  selectedProject: { tenantId: "tenant-1" } as { tenantId: string } | null,
  organizationsQueryArgs: vi.fn(),
}));

// nuqs keeps query-string state, so the stub has to be stateful: the component
// selects an organization and resets the search through these setters, and a
// no-op setter would hide all of that behaviour.
vi.mock("nuqs", async () => {
  const { useState } = await import("react");
  return {
    useQueryState: (_key: string, opts: { defaultValue: string }) => {
      const [value, setValue] = useState(opts.defaultValue);
      return [value, setValue];
    },
  };
});
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizations: (args: unknown) => {
    h.organizationsQueryArgs(args);
    return h.orgsResult;
  },
  useGetOrganizationConfig: () => h.configResult,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: h.selectedProject }),
}));
vi.mock("./organizations-filter-toolbar", () => ({
  useOrganizationsSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
  }),
}));
vi.mock("../organization-config", () => ({
  OrganizationConfig: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}));
type SidebarProps = {
  organizations: { itemId: string; name?: string }[];
  totalCount: number;
  selectedOrgId: string | null;
  onSelect: (org: { itemId: string }) => void;
  search: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

vi.mock("./organizations-sidebar-list", () => ({
  OrganizationsSidebarList: (props: SidebarProps) => (
    <div data-testid="sidebar">
      sidebar:{props.organizations.length}
      <span data-testid="sidebar-selected">{props.selectedOrgId ?? "none"}</span>
      <span data-testid="sidebar-total">{props.totalCount}</span>
      <span data-testid="sidebar-search">{props.search || "empty"}</span>
      <span data-testid="sidebar-flags">
        {`${props.isLoading}|${props.isLoadingMore}|${props.hasMore}`}
      </span>
      <button
        data-testid="select-last"
        onClick={() => props.onSelect(props.organizations[props.organizations.length - 1])}
      >
        select
      </button>
      <button data-testid="load-more" onClick={props.onLoadMore}>
        load more
      </button>
      <button data-testid="change-search" onClick={() => props.onSearchChange("globex")}>
        search
      </button>
    </div>
  ),
}));
vi.mock("./organization-workspace-panel", () => ({
  OrganizationWorkspacePanel: ({
    organizationId,
    onBack,
  }: {
    organizationId: string;
    onBack?: () => void;
  }) => (
    <div data-testid="workspace">
      workspace:{organizationId}
      <button data-testid="workspace-back" onClick={onBack}>
        back
      </button>
    </div>
  ),
}));

import { Organizations } from "./organizations";

beforeEach(() => {
  vi.clearAllMocks();
  h.selectedProject = { tenantId: "tenant-1" };
  h.orgsResult = {
    data: {
      isSuccess: true,
      organizations: [{ itemId: "o1", name: "Acme" }],
      totalCount: 1,
    },
    isLoading: false,
    isFetching: false,
  };
  h.configResult = {
    data: { isMultiOrgEnabled: true },
    isLoading: false,
  };
});

describe("Organizations", () => {
  it("renders the sidebar list and workspace when organizations load", () => {
    render(<Organizations />);
    expect(screen.getByTestId("sidebar").textContent).toContain("sidebar:1");
  });

  it("shows the multi-org-disabled card when the list reports the error", () => {
    h.orgsResult = {
      data: { isSuccess: false, errors: { multi_org_disabled: true } },
      isLoading: false,
      isFetching: false,
    };
    render(<Organizations />);
    expect(screen.getByText("Multiple Organizations is not enabled")).toBeTruthy();
    expect(screen.getByText("Configure Organization")).toBeTruthy();
  });

  it("shows the multi-org-disabled card when config reports it disabled", () => {
    h.configResult = { data: { isMultiOrgEnabled: false }, isLoading: false };
    render(<Organizations />);
    expect(screen.getByText("Multiple Organizations is not enabled")).toBeTruthy();
  });

  it("keeps the list visible while the config is still loading", () => {
    h.configResult = { data: undefined, isLoading: true };
    render(<Organizations />);
    expect(screen.queryByText("Multiple Organizations is not enabled")).toBeNull();
    expect(screen.getByTestId("sidebar")).toBeTruthy();
  });

  it("requests the first page of ten organizations", () => {
    render(<Organizations />);
    expect(h.organizationsQueryArgs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, pageSize: 10 }),
    );
  });

  it("reports nothing more to load when the first page covers the whole list", () => {
    h.orgsResult = {
      data: {
        isSuccess: true,
        organizations: [
          { itemId: "o1", name: "Acme" },
          { itemId: "o2", name: "Globex" },
          { itemId: "o3", name: "Initech" },
        ],
        totalCount: 3,
      },
      isLoading: false,
      isFetching: false,
    };
    render(<Organizations />);
    expect(screen.getByTestId("sidebar").textContent).toContain("sidebar:3");
    expect(screen.getByTestId("sidebar-total").textContent).toBe("3");
    expect(screen.getByTestId("sidebar-flags").textContent).toBe("false|false|false");
  });

  it("queries with an empty project key when no project is selected", () => {
    h.selectedProject = null;
    render(<Organizations />);
    expect(h.organizationsQueryArgs).toHaveBeenCalledWith(
      expect.objectContaining({ projectKey: "" }),
    );
  });

  it("auto-selects the first organization and opens its workspace", () => {
    render(<Organizations />);
    expect(screen.getByTestId("workspace").textContent).toContain("workspace:o1");
    expect(screen.getByTestId("sidebar-selected").textContent).toBe("o1");
  });

  it("switches the workspace to the organization picked in the sidebar", () => {
    h.orgsResult = {
      data: {
        isSuccess: true,
        organizations: [
          { itemId: "o1", name: "Acme" },
          { itemId: "o2", name: "Globex" },
        ],
        totalCount: 2,
      },
      isLoading: false,
      isFetching: false,
    };
    render(<Organizations />);
    expect(screen.getByTestId("workspace").textContent).toContain("workspace:o1");

    fireEvent.click(screen.getByTestId("select-last"));
    expect(screen.getByTestId("workspace").textContent).toContain("workspace:o2");
    expect(screen.getByTestId("sidebar-selected").textContent).toBe("o2");
  });

  it("clears the accumulated list when the search term changes", () => {
    render(<Organizations />);
    expect(screen.getByTestId("sidebar").textContent).toContain("sidebar:1");

    fireEvent.click(screen.getByTestId("change-search"));
    expect(screen.getByTestId("sidebar-search").textContent).toBe("globex");
    expect(screen.getByTestId("sidebar").textContent).toContain("sidebar:0");
  });

  it("appends the next page and drops organizations already loaded", () => {
    h.orgsResult = {
      data: {
        isSuccess: true,
        organizations: [{ itemId: "o1", name: "Acme" }],
        totalCount: 3,
      },
      isLoading: false,
      isFetching: false,
    };
    render(<Organizations />);
    expect(screen.getByTestId("sidebar-flags").textContent).toBe("false|false|true");

    // The next page repeats o1, which must not be duplicated in the list.
    h.orgsResult = {
      data: {
        isSuccess: true,
        organizations: [
          { itemId: "o1", name: "Acme" },
          { itemId: "o2", name: "Globex" },
        ],
        totalCount: 3,
      },
      isLoading: false,
      isFetching: true,
    };
    fireEvent.click(screen.getByTestId("load-more"));

    expect(screen.getByTestId("sidebar").textContent).toContain("sidebar:2");
    expect(screen.getByTestId("sidebar-flags").textContent).toBe("false|true|true");
  });

  it("reports the initial loading state until the first page arrives", () => {
    h.orgsResult = { data: undefined, isLoading: true, isFetching: true };
    render(<Organizations />);
    expect(screen.getByTestId("sidebar-flags").textContent).toBe("true|false|false");
    expect(screen.getByTestId("sidebar").textContent).toContain("sidebar:0");
  });

  it("shows the empty workspace placeholder until an organization is selected", () => {
    h.orgsResult = {
      data: { isSuccess: true, organizations: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
    };
    render(<Organizations />);
    expect(screen.queryByTestId("workspace")).toBeNull();
    expect(screen.getByText("Select an organization to view its details.")).toBeTruthy();
  });

  it("brings the list back on mobile when the workspace back control is used", () => {
    render(<Organizations />);
    const sidebarPane = screen.getByTestId("sidebar").parentElement as HTMLElement;
    const workspacePane = screen.getByTestId("workspace").parentElement as HTMLElement;
    expect(sidebarPane.classList.contains("hidden")).toBe(true);
    expect(workspacePane.classList.contains("hidden")).toBe(false);

    fireEvent.click(screen.getByTestId("workspace-back"));
    expect(sidebarPane.classList.contains("hidden")).toBe(false);
    expect(workspacePane.classList.contains("hidden")).toBe(true);
  });
});
