import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ resetFormData: vi.fn(), selectedTenantGroup: "grp-1" }));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: (selector: (s: { selectedTenantGroup: string }) => unknown) =>
    selector({ selectedTenantGroup: h.selectedTenantGroup }),
}));
vi.mock("./environment-service-selection-form", () => ({
  EnvironmentServiceSelectionForm: () => <div data-testid="selection-form" />,
}));
vi.mock("./review-confirm-form", () => ({
  ReviewConfirmForm: () => <div data-testid="review-form" />,
}));
vi.mock("./migration-form-state", () => ({
  useDataMigrationFormState: () => ({ resetFormData: h.resetFormData }),
}));

import { EnvironmentMigrationWizard } from "./environment-migration-wizard";

const renderWizard = () =>
  render(
    <MemoryRouter>
      <EnvironmentMigrationWizard />
    </MemoryRouter>,
  );

describe("EnvironmentMigrationWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedTenantGroup = "grp-1";
  });

  it("renders the first migration step", () => {
    renderWizard();
    expect(screen.getAllByTestId("selection-form").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("review-form")).toBeNull();
  });

  it("links the close control to the project environments path", () => {
    renderWizard();
    const closeLinks = screen.getAllByLabelText("Close migration");
    expect(closeLinks[0].getAttribute("href")).toContain("/app/project/grp-1/environments");
  });

  it("falls back to the console path when there is no selected tenant group", () => {
    h.selectedTenantGroup = "" as unknown as string;
    renderWizard();
    expect(screen.getAllByLabelText("Close migration")[0].getAttribute("href")).toContain(
      "/app/console",
    );
  });

  it("resets the form data when the close control is clicked", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getAllByLabelText("Close migration")[0]);
    expect(h.resetFormData).toHaveBeenCalled();
  });
});
