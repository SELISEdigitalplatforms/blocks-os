import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  createModel: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useCreateModel: () => ({ mutateAsync: h.createModel, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { CustomModelAddKeyModal } from "./aimodel-addkey-modal-custom";

const renderModal = (props = {}) =>
  render(<CustomModelAddKeyModal addKeyModalOpen setAddKeyModalOpen={vi.fn()} {...props} />);

const fillRequired = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText("Enter model name"), "my-model");
  await user.type(screen.getByPlaceholderText("Enter API URL"), "https://api.example.com/v1");
  await user.type(screen.getByPlaceholderText("Enter API Key"), "sk-123456");
  await user.type(screen.getByPlaceholderText("API Version"), "2024-01");
};

describe("CustomModelAddKeyModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.createModel.mockResolvedValue({ is_success: true });
  });

  it("renders the empty add form with the save button disabled", () => {
    renderModal();
    expect(screen.getByText("Add custom model")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });

  it("enables save and submits a created model once the required fields are valid", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    renderModal({ setAddKeyModalOpen: setOpen });
    await fillRequired(user);

    const save = screen.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    await user.click(save);

    await waitFor(() => expect(h.createModel).toHaveBeenCalledTimes(1));
    const payload = h.createModel.mock.calls[0][0];
    expect(payload.model_name).toBe("my-model");
    expect(payload.display_name).toBe("my-model");
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Model added successfully." });
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("keeps save disabled when the URL is not a valid URL", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText("Enter model name"), "my-model");
    await user.type(screen.getByPlaceholderText("Enter API URL"), "not-a-url");
    await user.type(screen.getByPlaceholderText("Enter API Key"), "sk-123456");
    await user.type(screen.getByPlaceholderText("API Version"), "2024-01");
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
    expect(await screen.findByText("Must be a valid URL")).toBeTruthy();
  });

  it("toasts the server detail when the create call is not successful", async () => {
    const user = userEvent.setup();
    h.createModel.mockResolvedValue({ is_success: false, detail: "duplicate name" });
    renderModal();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "duplicate name" }),
    );
  });

  it("toasts the error message when the create call throws", async () => {
    const user = userEvent.setup();
    h.createModel.mockRejectedValue(new Error("boom"));
    renderModal();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "boom" }));
  });

  it("adds another custom header row on demand", async () => {
    const user = userEvent.setup();
    renderModal();
    const before = screen.getAllByPlaceholderText("Header Key").length;
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    expect(screen.getAllByPlaceholderText("Header Key").length).toBe(before + 1);
  });
});
