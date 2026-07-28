import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ deletePermissions: vi.fn(), isPending: false, toast: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => h.toast(...a) }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserPermissions: () => ({ deletePermissions: h.deletePermissions, isPending: h.isPending }),
}));

import { DeleteUserPermission } from "./delete-user-permission";

const permission = { resource: "users::read" } as never;

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<DeleteUserPermission permission={permission} userId="u-1" />);
  await user.click(document.querySelector(".lucide-x") as Element);
  return screen.findByRole("dialog");
};

describe("DeleteUserPermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("excludes the permission and closes on success", async () => {
    h.deletePermissions.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(h.deletePermissions).toHaveBeenCalledWith(["users::read"]));
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("shows an error toast when the request reports failure", async () => {
    h.deletePermissions.mockResolvedValue({ isSuccess: false });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("shows an error toast when the request throws", async () => {
    h.deletePermissions.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});
