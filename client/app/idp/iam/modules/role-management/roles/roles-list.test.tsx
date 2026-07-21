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
}));

vi.mock("@/hooks/use-scoped-path", () => ({
  useScopedPath: () => (path: string) => `/scoped/${path}`,
}));

vi.mock("./roles-filter-toolbar", () => ({
  useRolesSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    SortHeader: ({ label }: { label: string }) => <span>{label}</span>,
  },
}));

vi.mock("../update-role/update-role", () => ({
  UpdateRole: ({ role }: { role: { name: string } }) => (
    <div data-testid="update-role-dialog">Editing {role.name}</div>
  ),
}));

import { RolesList } from "./roles-list";
import { IRole } from "@blocks-idp/iam/models/role";

const role = {
  itemId: "role-1",
  name: "Administrator",
  slug: "administrator",
  description: "Full access role",
  ancestorRoleSlugs: [],
  parentRoleSlug: null,
  canCreateOwn: true,
  count: 7,
  createdFromDefault: false,
  createdDate: "2024-01-01",
  lastUpdatedDate: "2024-01-01",
  createdBy: "system",
  language: null,
  lastUpdatedBy: "system",
  organizationId: "org-1",
  tags: [],
} as IRole;

describe("RolesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeletons and no table while loading", () => {
    const { container } = render(<RolesList roles={[]} isLoading />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("shows the empty-state message for no roles", () => {
    render(<RolesList roles={[]} isLoading={false} />);
    expect(
      screen.getByText("No roles found. Please create new roles."),
    ).toBeTruthy();
  });

  it("renders role rows with name, slug, permission count and description", () => {
    render(<RolesList roles={[role]} isLoading={false} />);
    expect(screen.getByText("Administrator")).toBeTruthy();
    expect(screen.getByText("administrator")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Full access role")).toBeTruthy();
  });

  it("navigates to the role detail page when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<RolesList roles={[role]} isLoading={false} />);
    await user.click(screen.getByText("Administrator"));
    expect(navigate).toHaveBeenCalledWith("/scoped/idp/role-detail/role-1");
  });

  it("opens the update-role dialog when the edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<RolesList roles={[role]} isLoading={false} />);
    expect(screen.queryByTestId("update-role-dialog")).toBeNull();
    // The only button in a row is the edit (Pencil) action.
    await user.click(screen.getByRole("button"));
    expect(screen.getByTestId("update-role-dialog")).toBeTruthy();
    expect(screen.getByText("Editing Administrator")).toBeTruthy();
    // Editing must not trigger row navigation.
    expect(navigate).not.toHaveBeenCalled();
  });
});
