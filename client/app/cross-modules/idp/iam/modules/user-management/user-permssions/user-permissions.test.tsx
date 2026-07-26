import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IPermission } from "@blocks-idp/iam/models/permission";

const h = vi.hoisted(() => ({
  permissions: [] as IPermission[],
  isLoading: false,
  deletePermissions: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserPermissions: () => ({
    permissions: h.permissions,
    isLoading: h.isLoading,
    deletePermissions: h.deletePermissions,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => h.toast(...a) }));
vi.mock("./add-user-permission", () => ({
  AddUserPermission: () => <div data-testid="add-permission" />,
}));
vi.mock("./user-permissions-list", () => ({
  UserPermissionsList: ({
    permissions,
    onRemovePermission,
  }: {
    permissions: IPermission[];
    onRemovePermission: (resource: string) => void;
  }) => (
    <div>
      {permissions.map((p) => (
        <button key={p.resource} onClick={() => onRemovePermission(p.resource)}>
          remove:{p.resource}
        </button>
      ))}
    </div>
  ),
}));

import { UserPermissions } from "./user-permissions";

const perm = (resource: string): IPermission => ({ resource }) as IPermission;

describe("UserPermissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.permissions = [perm("orders"), perm("users")];
    h.isLoading = false;
    h.deletePermissions = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("renders the permissions card and the add-permission control", () => {
    render(<UserPermissions userId="u-1" projectKey="pk" />);
    expect(screen.getByText("Permissions")).toBeTruthy();
    expect(screen.getByTestId("add-permission")).toBeTruthy();
    // Reset/Save appear only once something is removed.
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("reveals reset and save once a permission is removed", async () => {
    const user = userEvent.setup();
    render(<UserPermissions userId="u-1" projectKey="pk" />);
    await user.click(screen.getByText("remove:orders"));
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByText("remove:orders")).toBeNull();
  });

  it("restores the original list on reset", async () => {
    const user = userEvent.setup();
    render(<UserPermissions userId="u-1" projectKey="pk" />);
    await user.click(screen.getByText("remove:orders"));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("remove:orders")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("saves removed permissions and shows a success toast", async () => {
    const user = userEvent.setup();
    render(<UserPermissions userId="u-1" projectKey="pk" />);
    await user.click(screen.getByText("remove:users"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.deletePermissions).toHaveBeenCalledWith(["users"]));
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows an error toast when the save response is unsuccessful", async () => {
    const user = userEvent.setup();
    h.deletePermissions = vi.fn().mockResolvedValue({ isSuccess: false, errors: "nope" });
    render(<UserPermissions userId="u-1" projectKey="pk" />);
    await user.click(screen.getByText("remove:orders"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("shows an error toast when the save call throws", async () => {
    const user = userEvent.setup();
    h.deletePermissions = vi.fn().mockRejectedValue(new Error("network"));
    render(<UserPermissions userId="u-1" projectKey="pk" />);
    await user.click(screen.getByText("remove:orders"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});
