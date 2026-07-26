import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  navigate: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  isErrorWithErrors: (e: unknown): boolean =>
    typeof e === "object" && e !== null && "errors" in e,
}));

vi.mock("@/hooks/use-project", () => ({
  useDisableProject: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@seliseblocks/blocks-kit/store", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@seliseblocks/blocks-kit/utils", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  isErrorWithErrors: (e: unknown) => h.isErrorWithErrors(e),
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => h.navigate };
});

import { ArchiveProject } from "./archive";

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  render(
    <MemoryRouter>
      <ArchiveProject />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole("button", { name: /Delete/ }));
  await screen.findByRole("dialog");
};

describe("ArchiveProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("deletes the project and navigates to the console on success", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledWith("/app/console");
  });

  it("shows an error toast when the request reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "nope" } });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "nope" } }),
    );
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("shows an error toast for structured thrown errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { field: "bad" } });
    const user = userEvent.setup();
    await open(user);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { field: "bad" } }),
    );
  });
});
