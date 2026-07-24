import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  updateModel: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
    // the ui-kit tooltip re-exports these from blocks-kit
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useUpdateModel: () => ({ mutateAsync: h.updateModel, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { CustomModelEditKeyModal } from "./aimodel-editkey-modal-custom";

const model = {
  _id: "model-1",
  ModelName: "gpt-custom",
  Provider: "CUSTOM",
  DisplayName: "My Custom Model",
  BaseUrl: "https://api.example.com/v1",
  ApiKey: "sk-secret-key-1234567890",
  ApiVersion: "2024-01",
  IsActive: true,
  CustomParameters: { DefaultTemp: 0.5, MaxTokens: 2048 },
  CustomHeaders: { "X-Org": "acme" },
} as any;

const renderModal = (props = {}) =>
  render(
    <CustomModelEditKeyModal
      editKeyModalOpen
      setEditKeyModalOpen={vi.fn()}
      model={model}
      {...props}
    />,
  );

describe("CustomModelEditKeyModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.updateModel.mockResolvedValue({ is_success: true });
  });

  it("prefills the form from the model and masks the API key", () => {
    renderModal();
    expect(screen.getByText("Update Custom Model")).toBeTruthy();
    expect(screen.getByDisplayValue("gpt-custom")).toBeTruthy();
    expect(screen.getByDisplayValue("https://api.example.com/v1")).toBeTruthy();
    // The raw key is never shown; a masked form is displayed instead.
    expect(screen.queryByDisplayValue("sk-secret-key-1234567890")).toBeNull();
    expect(screen.getByDisplayValue(/sk-se•••••890/)).toBeTruthy();
  });

  it("reveals an editable API key input when the pen is clicked", async () => {
    const user = userEvent.setup();
    renderModal();
    const pen = screen
      .getAllByRole("button")
      .find((b) => b.querySelector("svg.lucide-pen"));
    await user.click(pen as HTMLElement);
    expect(screen.getByPlaceholderText("Enter new API key")).toBeTruthy();
  });

  it("submits an update payload and toasts success", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderModal({ setEditKeyModalOpen: setOpen });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.updateModel).toHaveBeenCalledTimes(1));
    const arg = h.updateModel.mock.calls[0][0];
    expect(arg.modelId).toBe("model-1");
    expect(arg.payload.model_name).toBe("gpt-custom");
    expect(arg.payload.custom_headers).toEqual({ "X-Org": "acme" });
    expect(arg.payload.custom_parameters).toMatchObject({ DefaultTemp: 0.5, MaxTokens: 2048 });
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Model updated successfully." });
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("toasts the server detail when the update is not successful", async () => {
    const user = userEvent.setup();
    h.updateModel.mockResolvedValue({ is_success: false, detail: "quota exceeded" });
    renderModal();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "quota exceeded" }));
  });

  it("toasts the error message when the update throws", async () => {
    const user = userEvent.setup();
    h.updateModel.mockRejectedValue(new Error("network error"));
    renderModal();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "network error" }));
  });

  it("adds and removes custom header rows", async () => {
    const user = userEvent.setup();
    renderModal();
    const before = screen.getAllByPlaceholderText("Header Key").length;
    await user.click(screen.getByRole("button", { name: /Add \(/ }));
    expect(screen.getAllByPlaceholderText("Header Key").length).toBe(before + 1);

    const trashButtons = screen
      .getAllByRole("button")
      .filter((b) => b.querySelector("svg.lucide-trash2"));
    await user.click(trashButtons[trashButtons.length - 1]);
    expect(screen.getAllByPlaceholderText("Header Key").length).toBe(before);
  });

  it("closes the modal from the cancel button", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderModal({ setEditKeyModalOpen: setOpen });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
