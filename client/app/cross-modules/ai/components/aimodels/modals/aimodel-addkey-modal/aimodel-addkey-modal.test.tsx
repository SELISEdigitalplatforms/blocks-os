import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServicePlatform } from "@blocks-ai/utils/aimodel-provider.utils";

const h = vi.hoisted(() => ({
  createModel: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useCreateModel: () => ({ mutateAsync: h.createModel, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { ModelAddKeyModal } from "./aimodel-addkey-modal";

const modelOptions = [
  { model: "gpt-4o", goodName: "GPT-4o" },
  { model: "gpt-4o-mini", goodName: "GPT-4o mini" },
];

const renderModal = (props = {}) =>
  render(
    <ModelAddKeyModal
      provider="openai"
      baseUrl="https://api.openai.com/v1"
      modelOptions={modelOptions}
      servicePlatform={ServicePlatform.OFFICIAL_API}
      addKeyModalOpen
      setAddKeyModalOpen={vi.fn()}
      {...props}
    />,
  );

describe("ModelAddKeyModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.createModel.mockResolvedValue({ is_success: true });
  });

  it("renders the provider title and the default model option", () => {
    renderModal();
    expect(screen.getByText("Add OpenAI Key")).toBeTruthy();
    expect(screen.getByText("GPT-4o")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });

  it("lets the user pick a different model from the dropdown", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText("GPT-4o"));
    await user.click(await screen.findByText("GPT-4o mini"));
    expect(screen.getByText("GPT-4o mini")).toBeTruthy();
  });

  it("enables save and creates a model when the api key is provided", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderModal({ setAddKeyModalOpen: setOpen });
    await user.type(screen.getByPlaceholderText("Enter API key"), "sk-new-key");

    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.createModel).toHaveBeenCalledTimes(1));
    const payload = h.createModel.mock.calls[0][0];
    expect(payload.provider).toBe("openai");
    expect(payload.api_key).toBe("sk-new-key");
    expect(payload.model_name).toBe("gpt-4o");
    expect(payload.base_url).toBe("https://api.openai.com/v1");
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Model added successfully." });
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("toasts the server detail when the create is not successful", async () => {
    const user = userEvent.setup();
    h.createModel.mockResolvedValue({ is_success: false, detail: "already exists" });
    renderModal();
    await user.type(screen.getByPlaceholderText("Enter API key"), "sk-new-key");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "already exists" }),
    );
  });

  it("toasts the error message when the create throws", async () => {
    const user = userEvent.setup();
    h.createModel.mockRejectedValue(new Error("kaput"));
    renderModal();
    await user.type(screen.getByPlaceholderText("Enter API key"), "sk-new-key");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "kaput" }));
  });
});
