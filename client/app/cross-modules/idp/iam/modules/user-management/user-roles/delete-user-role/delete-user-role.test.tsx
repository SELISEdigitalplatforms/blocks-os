import { render, screen, waitFor } from "@testing-library/react";
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

const { deleteRoles, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  deleteRoles: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useUserRoles: () => ({ deleteRoles, isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast,
  showSuccessToast,
  showInfoToast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import { DeleteUserRole } from "./delete-user-role";
import { IRole } from "@blocks-idp/iam/models/role";

const role = { itemId: "r1", name: "Editor", slug: "editor" } as IRole;

const openDialog = async (container: HTMLElement) => {
  const user = userEvent.setup();
  const trigger = container.querySelector(
    '[aria-haspopup="dialog"]',
  ) as HTMLElement;
  await user.click(trigger);
  return user;
};

describe("DeleteUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the confirmation dialog closed until the trigger is clicked", async () => {
    const { container } = render(
      <DeleteUserRole role={role} userId="user-1" projectKey="p1" />,
    );
    expect(screen.queryByText("Exclude Role")).toBeNull();

    await openDialog(container);

    expect(screen.getByText("Exclude Role")).toBeTruthy();
    expect(
      screen.getByText("Are you sure you want to exclude role?"),
    ).toBeTruthy();
  });

  it("excludes the role and shows a success toast on confirm", async () => {
    deleteRoles.mockResolvedValueOnce({ isSuccess: true });
    const { container } = render(
      <DeleteUserRole role={role} userId="user-1" projectKey="p1" />,
    );
    const user = await openDialog(container);

    await user.click(screen.getByRole("button", { name: "Yes" }));

    expect(deleteRoles).toHaveBeenCalledWith(["editor"]);
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled());
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when the exclusion fails", async () => {
    deleteRoles.mockResolvedValueOnce({
      isSuccess: false,
      errors: { role: "cannot remove" },
    });
    const { container } = render(
      <DeleteUserRole role={role} userId="user-1" projectKey="p1" />,
    );
    const user = await openDialog(container);

    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    expect(showSuccessToast).not.toHaveBeenCalled();
  });
});
