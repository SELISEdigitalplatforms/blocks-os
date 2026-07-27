import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useDeleteModel: () => ({ mutateAsync: h.mutateAsync }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { DeleteModel } from "./aimodel-deletemodel-modal";

describe("DeleteModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync.mockResolvedValue({ is_success: true });
  });

  it("renders the confirmation prompt when open", () => {
    render(<DeleteModel modelId="m1" open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Delete Model")).toBeTruthy();
    expect(screen.getByText("Are you sure you want to delete the model?")).toBeTruthy();
  });

  it("deletes the model and reports success", async () => {
    const onOpenChange = vi.fn();
    render(<DeleteModel modelId="m1" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete|Confirm|Yes/i }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledWith({ modelId: "m1", project_key: "tenant-1" }));
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error and closes when there is no model id", async () => {
    const onOpenChange = vi.fn();
    render(<DeleteModel modelId="" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete|Confirm|Yes/i }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when the delete response is unsuccessful", async () => {
    h.mutateAsync.mockResolvedValueOnce({ is_success: false, error: "cannot delete" });
    render(<DeleteModel modelId="m1" open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Delete|Confirm|Yes/i }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "cannot delete" }));
  });
});
