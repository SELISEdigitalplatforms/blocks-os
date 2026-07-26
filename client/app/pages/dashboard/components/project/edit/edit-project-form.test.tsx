import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@/hooks/use-project", () => ({
  useUpdateTenantGroup: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@seliseblocks/blocks-kit/utils", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  isErrorWithErrors: (e: unknown) => typeof e === "object" && e !== null && "errors" in e,
}));

import { EditProjectForm } from "./edit-project-form";

const renderForm = (onAfterSubmit = vi.fn()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Dialog open>
        <EditProjectForm tenantGroupId="grp-1" currentName="Old name" onAfterSubmit={onAfterSubmit} />
      </Dialog>
    </QueryClientProvider>,
  );
  return onAfterSubmit;
};

describe("EditProjectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("keeps Save disabled until the name is changed", () => {
    renderForm();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("updates the project name and reports success", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    const onAfterSubmit = renderForm();
    const input = screen.getByPlaceholderText("Enter project name");
    await user.clear(input);
    await user.type(input, "New name");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.mutateAsync).toHaveBeenCalledWith({ name: "New name", tenantGroupId: "grp-1" }),
    );
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(onAfterSubmit).toHaveBeenCalled();
  });

  it("shows an error toast when the update reports failure", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { name: "taken" } });
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByPlaceholderText("Enter project name");
    await user.type(input, " updated");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { name: "taken" } }),
    );
  });

  it("shows an error toast for structured thrown errors", async () => {
    h.mutateAsync.mockRejectedValue({ errors: { general: "boom" } });
    const user = userEvent.setup();
    renderForm();
    const input = screen.getByPlaceholderText("Enter project name");
    await user.type(input, " x");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "boom" } }),
    );
  });
});
