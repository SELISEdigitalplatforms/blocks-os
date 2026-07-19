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

const h = vi.hoisted(() => ({ saveProject: vi.fn() }));

vi.mock("@/hooks/use-project", () => ({
  useProjectForm: () => ({ isPending: false, saveProject: h.saveProject }),
}));

import { CreateProjectEnvironmentsForm } from "./create-project-environments-form";
import { useCreateProjectFormState } from "../../utils";

describe("CreateProjectEnvironmentsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateProjectFormState.getState().resetFormData();
  });

  it("renders the heading and the environment options with Submit disabled", () => {
    render(<CreateProjectEnvironmentsForm />);
    expect(screen.getByText("Select environments")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("Production")).toBeTruthy();
    // 8 environment options -> 8 checkboxes
    expect(screen.getAllByRole("checkbox")).toHaveLength(8);
    expect((screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("enables Submit after selecting an environment and saves the project", async () => {
    const user = userEvent.setup();
    render(<CreateProjectEnvironmentsForm />);

    // First checkbox corresponds to the "Development" (dev) option.
    await user.click(screen.getAllByRole("checkbox")[0]);

    const submit = screen.getByRole("button", { name: "Submit" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    await user.click(submit);
    expect(h.saveProject).toHaveBeenCalledTimes(1);
    expect(useCreateProjectFormState.getState().formData[2].environments).toEqual([
      { value: "dev" },
    ]);
  });
});
