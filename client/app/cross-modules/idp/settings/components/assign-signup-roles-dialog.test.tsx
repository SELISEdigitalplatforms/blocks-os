import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  roles: {
    data: {
      data: [
        { itemId: "r1", name: "Admin", slug: "admin" },
        { itemId: "r2", name: "Viewer", slug: "viewer" },
      ],
      totalCount: 2,
    },
    isLoading: false,
  },
  lastArgs: undefined as unknown,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (args: unknown) => {
    h.lastArgs = args;
    return h.roles;
  },
}));

import { AssignSignupRolesDialog } from "./assign-signup-roles-dialog";

const openDialog = async (user: ReturnType<typeof userEvent.setup>, onAssign = vi.fn()) => {
  render(<AssignSignupRolesDialog roles={[]} onAssign={onAssign} />);
  await user.click(screen.getByRole("button", { name: /Manage Roles/ }));
  await screen.findByRole("dialog");
  return onAssign;
};

describe("AssignSignupRolesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.roles = {
      data: {
        data: [
          { itemId: "r1", name: "Admin", slug: "admin" },
          { itemId: "r2", name: "Viewer", slug: "viewer" },
        ],
        totalCount: 2,
      },
      isLoading: false,
    };
  });

  it("lists the available roles when opened", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
  });

  it("shows an empty state when there are no roles", async () => {
    h.roles = { data: { data: [], totalCount: 0 }, isLoading: false };
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.getByText("No roles found")).toBeTruthy();
  });

  it("shows skeletons while loading", async () => {
    h.roles = { data: undefined as never, isLoading: true };
    const user = userEvent.setup();
    await openDialog(user);
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("selects roles and passes them to onAssign when Set is clicked", async () => {
    const user = userEvent.setup();
    const onAssign = await openDialog(user);
    await user.click(screen.getByRole("checkbox", { name: "Assign role Admin" }));
    await user.click(screen.getByRole("button", { name: "Set" }));
    await waitFor(() =>
      expect(onAssign).toHaveBeenCalledWith([
        expect.objectContaining({ slug: "admin" }),
      ]),
    );
  });

  it("deselects a role when unchecked", async () => {
    const user = userEvent.setup();
    const onAssign = await openDialog(user);
    const adminBox = screen.getByRole("checkbox", { name: "Assign role Admin" });
    await user.click(adminBox);
    await user.click(adminBox);
    await user.click(screen.getByRole("button", { name: "Set" }));
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith([]));
  });

  it("filters the role query when searching", async () => {
    const user = userEvent.setup();
    await openDialog(user);
    await user.type(screen.getByPlaceholderText("Search by role name"), "adm");
    await waitFor(() =>
      expect(h.lastArgs).toMatchObject({ filter: { search: "adm" }, page: 0 }),
    );
  });
});
