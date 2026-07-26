import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ goToStep: vi.fn() }));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({
    currentStep: 1,
    completedSteps: [false, true],
    goToStep: h.goToStep,
    getSteps: () => [
      { id: "s1", title: "Alpha" },
      { id: "s2", title: "Beta" },
    ],
  }),
}));

import StepHorizontalTrackBar from "./horizontal-track-bar";

describe("StepHorizontalTrackBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders each step title and a check for the completed step", () => {
    render(<StepHorizontalTrackBar />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    // Step 1 not completed shows number, step 2 completed shows a check.
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText("2")).toBeNull();
  });

  it("navigates to a step on button click", async () => {
    const user = userEvent.setup();
    render(<StepHorizontalTrackBar />);
    await user.click(screen.getByText("1"));
    expect(h.goToStep).toHaveBeenCalledWith(1);
  });
});
