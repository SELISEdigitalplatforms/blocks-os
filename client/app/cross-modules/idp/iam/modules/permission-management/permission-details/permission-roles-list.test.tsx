import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setQueryParams: vi.fn(),
  useGetRoles: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("nuqs", () => ({
  parseAsInteger: { withDefault: (d: number) => ({ defaultValue: d }) },
  useQueryStates: () => [{ page: 0, pageSize: 10 }, h.setQueryParams],
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (...args: unknown[]) => h.useGetRoles(...args),
}));

import { PermissionRolesList } from "./permission-roles-list";

const roles = [
  { itemId: "r-1", name: "Cloud Admin", slug: "cloudadmin", description: "Full access" },
  { itemId: "r-2", name: "Viewer", slug: "viewer", description: "Read only" },
];

describe("PermissionRolesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetRoles.mockReturnValue({
      data: { data: roles, totalCount: roles.length },
      isLoading: false,
    });
  });

  it("renders nothing when there are no slugs", () => {
    const { container } = render(<PermissionRolesList slugs={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows loading skeletons while roles are loading", () => {
    h.useGetRoles.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<PermissionRolesList slugs={["cloudadmin"]} />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("renders the assigned roles in a table", () => {
    render(<PermissionRolesList slugs={["cloudadmin", "viewer"]} />);
    expect(screen.getByText("Assigned Roles")).toBeTruthy();
    expect(screen.getByText("Cloud Admin")).toBeTruthy();
    expect(screen.getByText("viewer")).toBeTruthy();
    expect(screen.getByText("Read only")).toBeTruthy();
  });

  it("passes the provided slugs into the roles query", () => {
    render(<PermissionRolesList slugs={["cloudadmin"]} />);
    expect(h.useGetRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ slugs: ["cloudadmin"] }),
      }),
    );
  });

  it("shows an empty message when no roles are returned", () => {
    h.useGetRoles.mockReturnValue({ data: { data: [], totalCount: 0 }, isLoading: false });
    render(<PermissionRolesList slugs={["cloudadmin"]} />);
    expect(screen.getByText("No roles found. Please create new roles.")).toBeTruthy();
  });

  it("navigates to the role detail on row click", async () => {
    const user = userEvent.setup();
    render(<PermissionRolesList slugs={["cloudadmin", "viewer"]} />);

    await user.click(screen.getByText("Cloud Admin"));
    expect(h.navigate).toHaveBeenCalledWith("/scoped/idp/role-detail/r-1");
  });
});
