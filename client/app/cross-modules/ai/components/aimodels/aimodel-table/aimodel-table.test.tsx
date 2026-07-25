import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { validateModel, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  validateModel: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useValidateModel: () => ({ mutate: validateModel, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast, showSuccessToast }));
vi.mock(
  "@blocks-ai/components/aimodels/modals/aimodel-deletemodel-modal/aimodel-deletemodel-modal",
  () => ({ DeleteModel: () => <div data-testid="delete-modal" /> }),
);
vi.mock("@blocks-ai/components/aimodels/modals/aimodel-editkey-modal/aimodel-editkey-modal", () => ({
  ModelEditKeyModal: () => <div data-testid="edit-modal" />,
}));
vi.mock(
  "@blocks-ai/components/aimodels/modals/aimodel-editkey-modal-custom/aimodel-editkey-modal-custom",
  () => ({ CustomModelEditKeyModal: () => <div data-testid="custom-edit-modal" /> }),
);

import { AIModelsTable } from "./aimodel-table";
import type { IModelInfo } from "@blocks-ai/types/aimodel.service.type";

const models = [
  {
    _id: "m1",
    ModelName: "gpt",
    DisplayName: "GPT",
    ProjectKey: "t1",
    Provider: "OpenAI",
    BaseUrl: "https://api",
    ApiKey: "key",
    Status: "valid",
  },
  {
    _id: "m2",
    ModelName: "claude",
    DisplayName: "Claude",
    ProjectKey: "t1",
    Provider: "Anthropic",
    BaseUrl: "https://api2",
    ApiKey: "key2",
    Status: "invalid",
  },
] as unknown as IModelInfo[];

const findPlayButton = () =>
  Array.from(document.querySelectorAll("button")).find((b) => b.querySelector(".lucide-play"))!;

describe("AIModelsTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading skeleton while loading", () => {
    const { container } = render(<AIModelsTable custom={false} models={[]} isLoading />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no models", () => {
    render(<AIModelsTable custom={false} models={[]} isLoading={false} />);
    expect(screen.getByText("No models found.")).toBeTruthy();
  });

  it("renders a row per model with status badges", () => {
    render(<AIModelsTable custom={false} models={models} isLoading={false} />);
    expect(screen.getByText("GPT")).toBeTruthy();
    expect(screen.getByText("Claude")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("shows the provider column only in custom mode", () => {
    const { rerender } = render(
      <AIModelsTable custom={false} models={models} isLoading={false} />,
    );
    expect(screen.queryByText("Provider Name")).toBeNull();
    rerender(<AIModelsTable custom models={models} isLoading={false} />);
    expect(screen.getByText("Provider Name")).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();
  });

  it("validates a model and shows a success toast on a valid result", async () => {
    validateModel.mockImplementation((_args, opts) =>
      opts.onSuccess({ valid: { valid: true, message: "looks good" } }),
    );
    const user = userEvent.setup();
    render(<AIModelsTable custom={false} models={models} isLoading={false} />);
    await user.click(findPlayButton());
    await waitFor(() =>
      expect(validateModel).toHaveBeenCalledWith(
        { modelId: "m1", project_key: "t1" },
        expect.any(Object),
      ),
    );
    expect(showSuccessToast).toHaveBeenCalledWith({ description: "looks good" });
  });

  it("shows an error toast when validation reports invalid", async () => {
    validateModel.mockImplementation((_args, opts) =>
      opts.onSuccess({ valid: { valid: false, message: "bad key" } }),
    );
    const user = userEvent.setup();
    render(<AIModelsTable custom={false} models={models} isLoading={false} />);
    await user.click(findPlayButton());
    expect(showErrorToast).toHaveBeenCalledWith({ errors: "bad key" });
  });

  it("shows an error toast when validation errors out", async () => {
    validateModel.mockImplementation((_args, opts) => opts.onError(new Error("network")));
    const user = userEvent.setup();
    render(<AIModelsTable custom={false} models={models} isLoading={false} />);
    await user.click(findPlayButton());
    expect(showErrorToast).toHaveBeenCalledWith({ errors: "network" });
  });
});
