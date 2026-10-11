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

  describe("clearing environment selectors", () => {
    const pickEnvironments = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByLabelText("Source environment"));
      await user.click(await screen.findByRole("option", { name: "Development" }));
      await user.click(screen.getByLabelText("Target environment"));
      await user.click(await screen.findByRole("option", { name: "Production" }));
    };

    const continueButton = () =>
      screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;

    it("shows no clear buttons while nothing is selected", () => {
      render(<EnvironmentServiceSelectionForm />);
      expect(screen.queryByRole("button", { name: "Clear source environment" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear target environment" })).toBeNull();
    });

    it("shows no clear buttons while environments load, even with stored values", () => {
      useDataMigrationFormState.getState().setFormData(0, {
        ...useDataMigrationFormState.getState().formData[0],
        sourceEnvironment: "tenant-dev",
        sourceEnvironmentName: "Development",
        targetEnvironment: "tenant-prod",
        targetEnvironmentName: "Production",
      });
      h.useGetProjects.mockReturnValue({ data: [], isLoading: true });
      render(<EnvironmentServiceSelectionForm />);
      const target = screen.getByLabelText("Target environment");
      expect(target.getAttribute("data-disabled")).not.toBeNull();
      expect(screen.queryByRole("button", { name: "Clear source environment" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Clear target environment" })).toBeNull();
    });

    it("shows a clear button inside each selected field, before the chevron", async () => {
      const user = userEvent.setup();
      render(<EnvironmentServiceSelectionForm />);
      await pickEnvironments(user);
      const clearSource = await screen.findByRole("button", { name: "Clear source environment" });
      const clearTarget = screen.getByRole("button", { name: "Clear target environment" });
      const sourceTrigger = screen.getByLabelText("Source environment");
      // Sibling of the trigger, not nested in it, so it never opens the dropdown.
      expect(sourceTrigger.contains(clearSource)).toBe(false);
      expect(clearSource.parentElement).toBe(sourceTrigger.parentElement);
      expect(clearSource.className).toContain("right-9");
      expect(clearTarget.className).toContain("right-9");
      // The trigger reserves room so a long label truncates instead of running under the X,
      // and keeps its fixed height.
      expect(sourceTrigger.className).toContain("pr-14");
      expect(sourceTrigger.className).toContain("h-10");
      expect(sourceTrigger.className).toContain("[&>span]:line-clamp-1");
    });

    it("clears the source only, keeps everything else, and blocks Continue", async () => {
      const user = userEvent.setup();
      render(<EnvironmentServiceSelectionForm />);
      await pickEnvironments(user);
      await user.click(screen.getByLabelText("Select Localization"));
      await user.click(await screen.findByLabelText("Overwrite data for Localization"));
      await waitFor(() => expect(continueButton().disabled).toBe(false));
      const storeBefore = useDataMigrationFormState.getState().formData;
      const projectCallsBefore = h.useGetProjects.mock.calls.length;

      await user.click(screen.getByRole("button", { name: "Clear source environment" }));

      await waitFor(() => expect(screen.getByText("Select source environment")).toBeTruthy());
      expect(screen.queryByRole("button", { name: "Clear source environment" })).toBeNull();
      expect(screen.getByLabelText("Target environment").textContent).toContain("Production");
      expect(screen.getByRole("button", { name: "Clear target environment" })).toBeTruthy();
      expect(screen.getByLabelText("Select Localization").getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(
        screen.getByLabelText("Overwrite data for Localization").getAttribute("aria-checked"),
      ).toBe("true");
      await waitFor(() => expect(continueButton().disabled).toBe(true));
      // No dropdown opened and nothing was picked.
      expect(screen.queryByRole("listbox")).toBeNull();
      // Focus returns to the cleared selector.
      expect(document.activeElement).toBe(screen.getByLabelText("Source environment"));
      // The persisted wizard state only changes on Continue, and no new query args appear.
      expect(useDataMigrationFormState.getState().formData).toBe(storeBefore);
      for (const call of h.useGetProjects.mock.calls.slice(projectCallsBefore)) {
        expect(call[0]).toEqual({ tenantGroupId: "group-1", enabled: true });
      }
    });

    it("clears the target and re-enables the cleared option in the source list", async () => {
      const user = userEvent.setup();
      render(<EnvironmentServiceSelectionForm />);
      await pickEnvironments(user);

      await user.click(screen.getByLabelText("Source environment"));
      const prodWhileTargeted = await screen.findByRole("option", { name: "Production" });
      expect(prodWhileTargeted.getAttribute("data-disabled")).not.toBeNull();
      await user.keyboard("{Escape}");

      await user.click(screen.getByRole("button", { name: "Clear target environment" }));
      await waitFor(() => expect(screen.getByText("Select target environment")).toBeTruthy());
      expect(screen.getByLabelText("Source environment").textContent).toContain("Development");
      expect(document.activeElement).toBe(screen.getByLabelText("Target environment"));
      await waitFor(() => expect(continueButton().disabled).toBe(true));

      await user.click(screen.getByLabelText("Source environment"));
      const prodAfterClear = await screen.findByRole("option", { name: "Production" });
      expect(prodAfterClear.getAttribute("data-disabled")).toBeNull();
    });

    it("clears with Enter or Space from the keyboard", async () => {
      const user = userEvent.setup();
      render(<EnvironmentServiceSelectionForm />);
      await pickEnvironments(user);

      screen.getByRole("button", { name: "Clear source environment" }).focus();
      await user.keyboard("{Enter}");
      await waitFor(() => expect(screen.getByText("Select source environment")).toBeTruthy());
      expect(document.activeElement).toBe(screen.getByLabelText("Source environment"));
      expect(screen.queryByRole("listbox")).toBeNull();

      screen.getByRole("button", { name: "Clear target environment" }).focus();
      await user.keyboard(" ");
      await waitFor(() => expect(screen.getByText("Select target environment")).toBeTruthy());
      expect(document.activeElement).toBe(screen.getByLabelText("Target environment"));
    });

    it("submits the newly picked environments after a swap", async () => {
      const user = userEvent.setup();
      render(<EnvironmentServiceSelectionForm />);
      await pickEnvironments(user);
      await user.click(screen.getByLabelText("Select Localization"));

      await user.click(screen.getByRole("button", { name: "Clear source environment" }));
      await user.click(screen.getByRole("button", { name: "Clear target environment" }));
      await user.click(screen.getByLabelText("Source environment"));
      await user.click(await screen.findByRole("option", { name: "Production" }));
      await user.click(screen.getByLabelText("Target environment"));
      await user.click(await screen.findByRole("option", { name: "Development" }));

      await waitFor(() => expect(continueButton().disabled).toBe(false));
      await user.click(continueButton());
      await waitFor(() => expect(h.nextStep).toHaveBeenCalledTimes(1));
      const stored = useDataMigrationFormState.getState().formData[0];
      expect(stored.sourceEnvironment).toBe("tenant-prod");
      expect(stored.sourceEnvironmentName).toBe("Production");
      expect(stored.targetEnvironment).toBe("tenant-dev");
      expect(stored.targetEnvironmentName).toBe("Development");
    });

    it("keeps Continue disabled with a single environment selectable in one picker at a time", async () => {
      const user = userEvent.setup();
      h.useGetProjects.mockReturnValue({
        data: [
          {
            tenantGroupId: "group-1",
            projects: [{ tenantId: "tenant-main", environment: "main" }],
          },
        ],
        isLoading: false,
      });
      render(<EnvironmentServiceSelectionForm />);
      await user.click(screen.getByLabelText("Source environment"));
      const options = await screen.findAllByRole("option");
      expect(options).toHaveLength(1);
      await user.click(options[0]);
      await user.click(screen.getByLabelText("Target environment"));
      const targetOption = await screen.findByRole("option");
      expect(targetOption.getAttribute("data-disabled")).not.toBeNull();
      await user.keyboard("{Escape}");
      await user.click(screen.getByLabelText("Select Localization"));
      expect(continueButton().disabled).toBe(true);
    });
  });

  it("renders no environment options when there is no selected tenant group", () => {
    h.selectedTenantGroup = undefined;
    h.useGetProjects.mockReturnValue({ data: [], isLoading: false });
    render(<EnvironmentServiceSelectionForm />);
    expect(screen.getByText("Select source environment")).toBeTruthy();
  });
});
