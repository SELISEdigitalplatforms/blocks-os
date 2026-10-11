import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueMock } from "@/test-utils/__mocks__/catalogue.mock";

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

const h = vi.hoisted(() => ({
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  reload: vi.fn(),
  catalogue: { data: null as unknown, loading: false, error: null as Error | null },
}));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({
    nextStep: h.nextStep,
    previousStep: h.previousStep,
    goToStep: vi.fn(),
    currentStep: 2,
  }),
}));

vi.mock("@blocks-identifier/hooks/use-catalogue", () => ({
  useCatalogue: () => ({ ...h.catalogue, reload: h.reload }),
}));

import { CreateProjectEnvironmentsForm } from "./create-project-environments-form";
import { useCreateProjectFormState } from "../../utils";

const renderForm = () =>
  render(
    <MemoryRouter>
      <CreateProjectEnvironmentsForm />
    </MemoryRouter>,
  );

describe("CreateProjectEnvironmentsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateProjectFormState.getState().resetFormData();
    h.catalogue = { data: catalogueMock(), loading: false, error: null };
  });

  it("always includes the free-tier environment, locked, on the free tier", () => {
    renderForm();
    expect(useCreateProjectFormState.getState().selection.environments).toEqual(["dev"]);
    // dev has no checkbox (locked); test and prod do.
    expect(screen.queryByRole("checkbox", { name: /Development/ })).toBeNull();
    expect((screen.getByLabelText(/Free/, { selector: "input" }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByText("1 of 3")).toBeTruthy();
  });

  it("ticking an environment adds it in catalogue order and updates the total", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox", { name: /Production/ }));
    await user.click(screen.getByRole("checkbox", { name: /Test/ }));
    expect(useCreateProjectFormState.getState().selection.environments).toEqual([
      "dev",
      "test",
      "prod",
    ]);
    expect(screen.getAllByText("CHF 380").length).toBeGreaterThan(0);
  });

  it("free development cannot be topped up; paid can", async () => {
    const user = userEvent.setup();
    renderForm();
    // dev is focused by default
    expect(screen.getAllByText(/Free development can.t be topped up/).length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText(/Paid/, { selector: "input" }));
    expect(useCreateProjectFormState.getState().selection.devTier).toBe("paid");
    const more = screen.getAllByRole("button", { name: "One step more API calls" })[0];
    await user.click(more);
    expect(useCreateProjectFormState.getState().selection.topUps.dev).toEqual({ "api.calls": 1 });
    // dev paid includes 100,000 calls → ceiling one step
    expect((more as HTMLButtonElement).disabled).toBe(true);
  });

  it("moving back to free drops development top-ups", async () => {
    const user = userEvent.setup();
    useCreateProjectFormState.getState().setSelection({
      environments: ["dev"],
      devTier: "paid",
      topUps: { dev: { "api.calls": 1 } },
    });
    renderForm();
    await user.click(screen.getByLabelText(/Free/, { selector: "input" }));
    expect(useCreateProjectFormState.getState().selection.topUps.dev).toBeUndefined();
  });

  it("shows every limit of the focused environment, with policy -1 as Never stops", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Show what Production includes" }));
    expect(screen.getAllByRole("heading", { name: "Production" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Never stops").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,200,000").length).toBeGreaterThan(0);
  });

  it("offers a retry when the catalogue cannot be loaded", async () => {
    const user = userEvent.setup();
    h.catalogue = { data: null, loading: false, error: new Error("offline") };
    renderForm();
    expect(screen.getByText("The environment list could not be loaded.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.reload).toHaveBeenCalled();
  });

  it("Continue advances, Back goes back", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(h.nextStep).toHaveBeenCalledTimes(1);
    expect(h.previousStep).toHaveBeenCalledTimes(1);
  });
});
