import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  projectStatus: false as boolean | undefined,
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  isErrorWithErrors: (e: unknown): boolean =>
    typeof e === "object" && e !== null && "errors" in e,
}));

vi.mock("@/hooks/use-project", () => ({
  useGetProjectStatus: () => ({ data: h.projectStatus }),
  useRestoreProject: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@seliseblocks/blocks-kit/utils", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  isErrorWithErrors: (e: unknown) => h.isErrorWithErrors(e),
}));

import { RestoreProject } from "./restore";

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<RestoreProject itemId="item-1" />);
  await user.click(screen.getByRole("button", { name: /Restore/ }));
  await screen.findByRole("dialog");
};

describe("RestoreProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.projectStatus = false;
  });

  it("renders nothing when the setup status is complete", () => {
    h.projectStatus = true;
    render(<RestoreProject itemId="item-1" />);
    expect(screen.queryByRole("button", { name: /Restore/ })).toBeNull();
  });

  it("renders nothing while the status is unknown", () => {
    h.projectStatus = undefined;
    render(<RestoreProject itemId="item-1" />);
    expect(screen.queryByRole("button", { name: /Restore/ })).toBeNull();
  });

  it("restores the environment on confirm", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledWith({ itemId: "item-1" }));
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the request reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "nope" } });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "nope" } }),
    );
  });

  it("shows an error toast for structured thrown errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { field: "bad" } });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { field: "bad" } }),
    );
  });
});
