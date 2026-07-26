import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const h = vi.hoisted(() => ({
  nextStep: vi.fn(),
  refetchAuthorization: vi.fn().mockResolvedValue({ data: { isSuccess: false } }),
}));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({ nextStep: h.nextStep }),
}));

vi.mock("@/cross-modules/devops/hooks/github-info", () => ({
  useValidateAuthorization: () => ({ data: undefined, refetch: h.refetchAuthorization }),
  useGetRepositoryUser: () => ({ data: undefined }),
}));

vi.mock("@/cross-modules/devops/models/github-info", () => ({
  iconMap: { github: "/assets/github-icon.svg" },
}));

vi.mock("@/cross-modules/devops/components/deployment-steps/render-repos/render-provider", () => ({
  default: () => <div>provider-buttons</div>,
}));

vi.mock("@/components/repository-selection-modal/repository-selection-modal", () => ({
  RepositorySelectionModal: ({ open }: { open: boolean }) =>
    open ? <div>repository-selection-modal</div> : null,
}));

import { CreateProjectResourcesForm } from "./create-project-resources-form";
import { useCreateProjectFormState } from "../../utils";

describe("CreateProjectResourcesForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateProjectFormState.getState().resetFormData();
  });

  it("renders the add-resource UI with an eventually-enabled Continue button", async () => {
    render(<CreateProjectResourcesForm />);
    expect(screen.getByText("Add resource")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add repository/ })).toBeTruthy();
    // assets are optional in the schema, so Continue becomes valid once validation resolves.
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });

  it("advances the stepper when Continue is clicked", async () => {
    const user = userEvent.setup();
    render(<CreateProjectResourcesForm />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(h.nextStep).toHaveBeenCalledTimes(1);
  });

  it("opens the Connect repository dialog when authorization is not yet granted", async () => {
    const user = userEvent.setup();
    render(<CreateProjectResourcesForm />);

    await user.click(screen.getByRole("button", { name: /Add repository/ }));

    expect(h.refetchAuthorization).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Connect repository")).toBeTruthy();
    expect(screen.getByText("provider-buttons")).toBeTruthy();
  });
});
