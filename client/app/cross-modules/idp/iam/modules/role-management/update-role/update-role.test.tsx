import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useUpdateRole: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: h.toast }),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { UpdateRole } from "./update-role";
import type { IRole } from "@blocks-idp/iam/models/role";

const role = { itemId: "role-1", name: "Admin", description: "Admin role" } as IRole;

const renderUpdateRole = (onClose = vi.fn()) => {
  render(
    <Dialog open>
      <UpdateRole role={role} isOpen onClose={onClose} />
    </Dialog>,
  );
  return { onClose };
};

describe("UpdateRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders the role fields pre-filled", () => {
    renderUpdateRole();
    expect(screen.getByText("Update Role")).toBeTruthy();
    expect((screen.getByPlaceholderText("Enter name") as HTMLInputElement).value).toBe("Admin");
  });

  it("keeps Update disabled until the form is dirtied", () => {
    renderUpdateRole();
    expect((screen.getByRole("button", { name: "Update" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.change(screen.getByPlaceholderText("Enter name"), { target: { value: "Manager" } });
    expect((screen.getByRole("button", { name: "Update" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("submits the update and reports success then closes", async () => {
    const { onClose } = renderUpdateRole();
    fireEvent.change(screen.getByPlaceholderText("Enter name"), { target: { value: "Manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ itemId: "role-1", name: "Manager" });
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error toast when the update throws", async () => {
    h.mutateAsync.mockRejectedValueOnce({ errors: { general: "bad" } });
    renderUpdateRole();
    fireEvent.change(screen.getByPlaceholderText("Enter name"), { target: { value: "Manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
