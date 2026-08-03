import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ goToStep: vi.fn() }));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({
    currentStep: 2,
    totalSteps: 3,
    goToStep: h.goToStep,
    completedSteps: [true, false, false],
    getSteps: () => [
      { id: "s1", title: "First" },
      { id: "s2", title: "Second" },
      { id: "s3", title: "Third" },
    ],
  }),
}));

import StepVerticalTrackBar from "./vertical-track-bar";

describe("StepVerticalTrackBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders each step title and shows a check for completed steps", () => {
    render(<StepVerticalTrackBar />);
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.getByText("Third")).toBeTruthy();
    // Completed first step shows a check icon instead of the number "1".
    expect(screen.queryByText("1")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("navigates to the step when its button is clicked", async () => {
    const user = userEvent.setup();
    render(<StepVerticalTrackBar />);
    await user.click(screen.getByText("2"));
    expect(h.goToStep).toHaveBeenCalledWith(2);
  });
});
