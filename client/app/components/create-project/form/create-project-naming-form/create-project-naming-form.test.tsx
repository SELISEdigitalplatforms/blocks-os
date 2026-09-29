import { render, screen } from "@testing-library/react";
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

const h = vi.hoisted(() => ({ nextStep: vi.fn() }));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({ nextStep: h.nextStep }),
}));

import { CreateProjectNamingForm } from "./create-project-naming-form";
import { useCreateProjectFormState } from "../../utils";

describe("CreateProjectNamingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateProjectFormState.getState().resetFormData();
  });

  it("renders the heading, input and checkboxes with Continue disabled by default", () => {
    render(<CreateProjectNamingForm />);
    expect(screen.getByText("Name your project")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter your project name")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("updates the name field as the user types", async () => {
    const user = userEvent.setup();
    render(<CreateProjectNamingForm />);
    const input = screen.getByPlaceholderText("Enter your project name") as HTMLInputElement;

    await user.type(input, "My Project");
    expect(input.value).toBe("My Project");
  });

  it("toggles the checkboxes", async () => {
    const user = userEvent.setup();
    render(<CreateProjectNamingForm />);
    const [exclusive, terms] = screen.getAllByRole("checkbox");

    expect(exclusive.getAttribute("aria-checked")).toBe("false");
    await user.click(exclusive);
    expect(exclusive.getAttribute("aria-checked")).toBe("true");

    await user.click(terms);
    expect(terms.getAttribute("aria-checked")).toBe("true");
  });

  it("enables Continue and advances the stepper once the form is valid", async () => {
    const user = userEvent.setup();
    render(<CreateProjectNamingForm />);

    await user.type(screen.getByPlaceholderText("Enter your project name"), "My Project");
    const [exclusive, terms] = screen.getAllByRole("checkbox");
    await user.click(exclusive);
    await user.click(terms);

    const continueBtn = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueBtn.disabled).toBe(false);

    await user.click(continueBtn);
    expect(h.nextStep).toHaveBeenCalledTimes(1);
    expect(useCreateProjectFormState.getState().formData[0].name).toBe("My Project");
  });
});
