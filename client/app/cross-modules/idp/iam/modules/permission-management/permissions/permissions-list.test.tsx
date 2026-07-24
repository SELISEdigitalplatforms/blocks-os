import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
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

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-testid="edit-link">
      {children}
    </a>
  ),
}));

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (path: string) => `/scoped/${path}`,
}));

vi.mock("./permissions-filter-toolbar", () => ({
  usePermissionsSortQuaryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SortHeader: ({ label }: { label: string }) => <span>{label}</span>,
  },
}));

import { PermissionsList } from "./permissions-list";
import {
  IPermission,
  PermissionSeverityLevel,
} from "@blocks-idp/iam/models/permission";

const customPermission = {
  itemId: "perm-custom",
  name: "Manage Billing",
  type: 1,
  description: "",
  resource: "billing",
  resourceGroup: "finance",
  projectKey: "p1",
  tags: [],
  roles: ["admin", "owner"],
  dependentPermissions: [],
  isArchived: false,
  isBuiltIn: false,
  language: null,
  organizationIds: [],
  permissionSeverity: PermissionSeverityLevel.Critical,
} as IPermission;

const builtInPermission = {
  ...customPermission,
  itemId: "perm-builtin",
  name: "Read Users",
  resource: "users",
  roles: [],
  isBuiltIn: true,
  permissionSeverity: PermissionSeverityLevel.Low,
} as IPermission;

describe("PermissionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no table while loading", () => {
    const { container } = render(
      <PermissionsList permissions={[]} isLoading />,
    );
    expect(container.querySelector("table")).toBeNull();
  });

  it("shows the empty-state message for no permissions", () => {
    render(<PermissionsList permissions={[]} isLoading={false} />);
    expect(
      screen.getByText("No permission found. Please create new permission."),
    ).toBeTruthy();
  });

  it("renders permission rows with name, resource, source, severity and role count", () => {
    render(
      <PermissionsList
        permissions={[customPermission, builtInPermission]}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Manage Billing")).toBeTruthy();
    expect(screen.getByText("Read Users")).toBeTruthy();
    expect(screen.getByText("billing")).toBeTruthy();
    // isBuiltIn column
    expect(screen.getByText("Custom")).toBeTruthy();
    expect(screen.getByText("Built In")).toBeTruthy();
    // severity badges
    expect(screen.getByText("Critical")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
    // roles count for the custom permission (2 roles)
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("only renders an edit link for custom (non built-in) permissions", () => {
    render(
      <PermissionsList
        permissions={[customPermission, builtInPermission]}
        isLoading={false}
      />,
    );
    const links = screen.getAllByTestId("edit-link");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toContain("perm-custom");
  });

  it("navigates to the permission detail page when a row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <PermissionsList permissions={[customPermission]} isLoading={false} />,
    );
    await user.click(screen.getByText("Manage Billing"));
    expect(navigate).toHaveBeenCalledWith(
      "/scoped/idp/permission-detail/perm-custom",
    );
  });
});
