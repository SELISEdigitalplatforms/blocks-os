import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServicePlatform } from "@blocks-ai/utils/aimodel-provider.utils";

const h = vi.hoisted(() => ({
  updateModel: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useUpdateModel: () => ({ mutateAsync: h.updateModel, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { ModelEditKeyModal } from "./aimodel-editkey-modal";

const modelOptions = [
  { model: "gpt-4o", goodName: "GPT-4o" },
  { model: "gpt-4o-mini", goodName: "GPT-4o mini" },
];

const model = {
  _id: "model-1",
  Provider: "openai",
  ServicePlatform: ServicePlatform.OFFICIAL_API,
  ModelName: "gpt-4o",
  DisplayName: "OpenAI GPT-4o",
  BaseUrl: "https://api.openai.com/v1",
  ApiKey: "sk-secret-key-9999999",
  ApiVersion: "2024-01",
  IsActive: true,
  OpenAiOrganizationId: "org-1",
  OpenAiProjectId: "proj-1",
} as any;

const renderModal = (props = {}) =>
  render(
    <ModelEditKeyModal
      modelOptions={modelOptions}
      editKeyModalOpen
      setEditKeyModalOpen={vi.fn()}
      model={model}
      {...props}
    />,
  );

describe("ModelEditKeyModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.updateModel.mockResolvedValue({ is_success: true });
  });

  it("renders the provider title, resolved model name and masked key", () => {
    renderModal();
    expect(screen.getByText("Update OpenAI Key")).toBeTruthy();
    expect(screen.getByText("GPT-4o")).toBeTruthy();
    expect(screen.queryByDisplayValue("sk-secret-key-9999999")).toBeNull();
    expect(screen.getByDisplayValue(/sk-se•••••999/)).toBeTruthy();
  });

  it("submits an update without a new api key and toasts success", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderModal({ setEditKeyModalOpen: setOpen });
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.updateModel).toHaveBeenCalledTimes(1));
    const arg = h.updateModel.mock.calls[0][0];
    expect(arg.modelId).toBe("model-1");
    // The key is unchanged, so no api_key is sent.
    expect(arg.payload.api_key).toBeUndefined();
    expect(arg.payload.model_name).toBe("gpt-4o");
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Model updated successfully." });
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("sends a new api key when the key is edited", async () => {
    const user = userEvent.setup();
    renderModal();
    const pen = screen.getAllByRole("button").find((b) => b.querySelector("svg.lucide-pen"));
    await user.click(pen as HTMLElement);
    await user.type(screen.getByPlaceholderText("Enter new API key"), "sk-brand-new-key");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.updateModel).toHaveBeenCalledTimes(1));
    expect(h.updateModel.mock.calls[0][0].payload.api_key).toBe("sk-brand-new-key");
  });

  it("toasts the server detail when the update is not successful", async () => {
    const user = userEvent.setup();
    h.updateModel.mockResolvedValue({ is_success: false, detail: "invalid key" });
    renderModal();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "invalid key" }));
  });

  it("toasts the error message when the update throws", async () => {
    const user = userEvent.setup();
    h.updateModel.mockRejectedValue(new Error("network"));
    renderModal();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "network" }));
  });
});
