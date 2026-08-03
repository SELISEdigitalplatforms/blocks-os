import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  nextStep: vi.fn(),
  useGetProjects: vi.fn(),
  selectedTenantGroup: "group-1" as string | undefined,
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedTenantGroup: h.selectedTenantGroup }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({ nextStep: h.nextStep }),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProjects: (args: unknown) => h.useGetProjects(args),
}));

import { EnvironmentServiceSelectionForm } from "./environment-service-selection-form";
import { useDataMigrationFormState } from "./migration-form-state";

const projectGroups = [
  {
    tenantGroupId: "group-1",
    projects: [
      { tenantId: "tenant-dev", environment: "dev" },
      { tenantId: "tenant-prod", environment: "prod" },
    ],
  },
];

describe("EnvironmentServiceSelectionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedTenantGroup = "group-1";
    useDataMigrationFormState.getState().resetFormData();
    h.useGetProjects.mockReturnValue({ data: projectGroups, isLoading: false });
  });

  it("renders the environment pickers and the service catalog", () => {
    render(<EnvironmentServiceSelectionForm />);
    expect(screen.getByText("Select environments & services")).toBeTruthy();
    expect(screen.getByLabelText("Source environment")).toBeTruthy();
    expect(screen.getByLabelText("Target environment")).toBeTruthy();
    // Available services expose an enabled checkbox, unavailable ones a disabled one.
    expect((screen.getByLabelText("Select Localization") as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByLabelText("Select Email") as HTMLButtonElement).disabled).toBe(true);
    // Unavailable services render the disabled hint.
    expect(screen.getAllByText("Not available for this service").length).toBeGreaterThan(0);
  });

  it("shows the loading placeholder and disables the source picker while projects load", () => {
    h.useGetProjects.mockReturnValue({ data: [], isLoading: true });
    render(<EnvironmentServiceSelectionForm />);
    expect(screen.getAllByText("Loading environments...").length).toBeGreaterThan(0);
    const source = screen.getByLabelText("Source environment") as HTMLButtonElement;
    expect(source.getAttribute("data-disabled")).not.toBeNull();
  });

  it("keeps the continue button disabled until the form is valid", () => {
    render(<EnvironmentServiceSelectionForm />);
    const submit = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("selects environments, picks a service and advances to the next step", async () => {
    const user = userEvent.setup();
    render(<EnvironmentServiceSelectionForm />);

    await user.click(screen.getByLabelText("Source environment"));
    await user.click(await screen.findByRole("option", { name: "Development" }));

    await user.click(screen.getByLabelText("Target environment"));
    await user.click(await screen.findByRole("option", { name: "Production" }));

    await user.click(screen.getByLabelText("Select Localization"));

    const submit = await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      return btn;
    });
    await user.click(submit);

    await waitFor(() => expect(h.nextStep).toHaveBeenCalledTimes(1));
    const stored = useDataMigrationFormState.getState().formData[0];
    expect(stored.sourceEnvironment).toBe("tenant-dev");
    expect(stored.targetEnvironment).toBe("tenant-prod");
    expect(stored.services.some((s) => s.name === "Language" && s.selected)).toBe(true);
  });

  it("reveals the overwrite-data switch once a service is selected and toggles it", async () => {
    const user = userEvent.setup();
    render(<EnvironmentServiceSelectionForm />);
    expect(screen.queryByLabelText("Overwrite data for Localization")).toBeNull();
    await user.click(screen.getByLabelText("Select Localization"));
    const overwrite = await screen.findByLabelText("Overwrite data for Localization");
    expect(overwrite.getAttribute("aria-checked")).toBe("false");
    await user.click(overwrite);
    await waitFor(() =>
      expect(
        screen.getByLabelText("Overwrite data for Localization").getAttribute("aria-checked"),
      ).toBe("true"),
    );
  });

  it("renders no environment options when there is no selected tenant group", () => {
    h.selectedTenantGroup = undefined;
    h.useGetProjects.mockReturnValue({ data: [], isLoading: false });
    render(<EnvironmentServiceSelectionForm />);
    expect(screen.getByText("Select source environment")).toBeTruthy();
  });
});
