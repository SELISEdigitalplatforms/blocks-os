import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IRole } from "@blocks-idp/iam/models/role";

const h = vi.hoisted(() => ({
  roles: [] as IRole[],
  isLoading: false,
  deleteRoles: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserRoles: () => ({
    roles: h.roles,
    isLoading: h.isLoading,
    deleteRoles: h.deleteRoles,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("./add-user-role", () => ({
  AddUserRole: () => <button type="button">Assign Role</button>,
}));
vi.mock("./user-roles-list", () => ({
  UserRolesList: ({
    roles,
    onRemoveRole,
  }: {
    roles: IRole[];
    onRemoveRole: (slug: string) => void;
  }) => (
    <ul>
      {roles.map((role) => (
        <li key={role.slug}>
          <span>{role.name}</span>
          <button type="button" onClick={() => onRemoveRole(role.slug)}>
            remove-{role.slug}
          </button>
        </li>
      ))}
    </ul>
  ),
}));

import { UserRoles } from "./user-roles";

const roles = [
  { itemId: "r-1", name: "Cloud Admin", slug: "cloudadmin" },
  { itemId: "r-2", name: "Viewer", slug: "viewer" },
] as unknown as IRole[];

describe("UserRoles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.roles = roles;
    h.isLoading = false;
    h.deleteRoles.mockResolvedValue({ isSuccess: true });
  });

  it("lists the roles without Reset/Save until a removal is pending", () => {
    render(<UserRoles id="u1" projectKey="p1" />);
    expect(screen.getByText("Cloud Admin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });

  it("reveals Reset/Save once a role is removed locally", async () => {
    const user = userEvent.setup();
    render(<UserRoles id="u1" projectKey="p1" />);

    await user.click(screen.getByRole("button", { name: "remove-cloudadmin" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByText("Cloud Admin")).toBeNull();
  });

  it("persists the removed role slugs on Save", async () => {
    const user = userEvent.setup();
    render(<UserRoles id="u1" projectKey="p1" />);

    await user.click(screen.getByRole("button", { name: "remove-cloudadmin" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.deleteRoles).toHaveBeenCalledWith(["cloudadmin"]));
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Roles updated successfully" });
  });

  it("restores the local roles on Reset", async () => {
    const user = userEvent.setup();
    render(<UserRoles id="u1" projectKey="p1" />);

    await user.click(screen.getByRole("button", { name: "remove-cloudadmin" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByText("Cloud Admin")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("surfaces a backend error when the removal fails", async () => {
    const user = userEvent.setup();
    h.deleteRoles.mockResolvedValue({ isSuccess: false, errors: { role: "in use" } });
    render(<UserRoles id="u1" projectKey="p1" />);

    await user.click(screen.getByRole("button", { name: "remove-viewer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { role: "in use" } }),
    );
  });

  it("falls back to a generic error when the removal throws", async () => {
    const user = userEvent.setup();
    h.deleteRoles.mockRejectedValue(new Error("boom"));
    render(<UserRoles id="u1" projectKey="p1" />);

    await user.click(screen.getByRole("button", { name: "remove-viewer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });
});
