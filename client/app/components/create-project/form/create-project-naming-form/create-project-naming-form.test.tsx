import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
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

const h = vi.hoisted(() => ({ nextStep: vi.fn(), goToStep: vi.fn() }));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({ nextStep: h.nextStep, goToStep: h.goToStep, currentStep: 1 }),
}));

import { CreateProjectNamingForm } from "./create-project-naming-form";
import { useCreateProjectFormState } from "../../utils";

const renderForm = () =>
  render(
    <MemoryRouter>
      <CreateProjectNamingForm />
    </MemoryRouter>,
  );

describe("CreateProjectNamingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateProjectFormState.getState().resetFormData();
  });

  it("renders name, description and terms with Continue disabled by default", () => {
    renderForm();
    expect(screen.getByRole("heading", { name: "Name your project" })).toBeTruthy();
    expect(screen.getByLabelText("Project name")).toBeTruthy();
    expect(screen.getByPlaceholderText("What this project is for.")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("Give the project a name to continue.")).toBeTruthy();
  });

  it("previews the identifier as the name is typed", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Project name"), "Northwind Portal");
    expect(screen.getByText("northwind-portal")).toBeTruthy();
  });

  it("stays disabled until both terms are accepted", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Project name"), "My Project");
    const [exclusive] = screen.getAllByRole("checkbox");
    await user.click(exclusive);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("refuses a two-letter name", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Project name"), "ab");
    const [exclusive, terms] = screen.getAllByRole("checkbox");
    await user.click(exclusive);
    await user.click(terms);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("saves trimmed values and advances once valid", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText("Project name"), "  My Project  ");
    await user.type(screen.getByPlaceholderText("What this project is for."), " Billing portal ");
    const [exclusive, terms] = screen.getAllByRole("checkbox");
    await user.click(exclusive);
    await user.click(terms);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(h.nextStep).toHaveBeenCalledTimes(1);
    const { naming } = useCreateProjectFormState.getState();
    expect(naming.name).toBe("My Project");
    expect(naming.description).toBe("Billing portal");
  });
});
