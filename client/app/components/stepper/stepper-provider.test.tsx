import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StepperProvider, { useStepper } from "./stepper-provider";
import type { Steps } from "./stepper-models";

const steps: Steps = [
  { id: 1, title: "One" },
  { id: 2, title: "Two" },
  { id: 3, title: "Three" },
];

const Harness = () => {
  const {
    currentStep,
    completedSteps,
    totalSteps,
    nextStep,
    previousStep,
    goToStep,
    getSteps,
  } = useStepper();
  return (
    <div>
      <span data-testid="current">{currentStep}</span>
      <span data-testid="completed">{completedSteps.join(",")}</span>
      <span data-testid="total">{totalSteps}</span>
      <span data-testid="steps">{getSteps().map((s) => s.title).join("|")}</span>
      <button onClick={nextStep}>next</button>
      <button onClick={previousStep}>prev</button>
      <button onClick={() => goToStep(3)}>goto3</button>
      <button onClick={() => goToStep(2)}>goto2</button>
      <button onClick={() => goToStep(9)}>goto9</button>
    </div>
  );
};

const renderStepper = (props: Partial<React.ComponentProps<typeof StepperProvider>> = {}) =>
  render(
    <StepperProvider steps={steps} {...props}>
      <Harness />
    </StepperProvider>,
  );

describe("StepperProvider / useStepper", () => {
  it("throws when useStepper is used outside a provider", () => {
    const Consumer = () => {
      useStepper();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      "useStepper must be used within a StepperProvider",
    );
    spy.mockRestore();
  });

  it("exposes the steps and total, defaulting to the first step", () => {
    renderStepper();
    expect(screen.getByTestId("current").textContent).toBe("1");
    expect(screen.getByTestId("total").textContent).toBe("3");
    expect(screen.getByTestId("steps").textContent).toBe("One|Two|Three");
    expect(screen.getByTestId("completed").textContent).toBe("");
  });

  it("seeds completed steps from a non-default initial step", () => {
    renderStepper({ initialStep: 3 });
    expect(screen.getByTestId("current").textContent).toBe("3");
    expect(screen.getByTestId("completed").textContent).toBe("1,2");
  });

  it("advances with nextStep and records the completed step, stopping at the last", async () => {
    const user = userEvent.setup();
    renderStepper();
    await user.click(screen.getByText("next"));
    expect(screen.getByTestId("current").textContent).toBe("2");
    expect(screen.getByTestId("completed").textContent).toBe("1");
    await user.click(screen.getByText("next"));
    expect(screen.getByTestId("current").textContent).toBe("3");
    // already at the last step, nextStep is a no-op
    await user.click(screen.getByText("next"));
    expect(screen.getByTestId("current").textContent).toBe("3");
  });

  it("moves backwards with previousStep and cannot go below step one", async () => {
    const user = userEvent.setup();
    renderStepper({ initialStep: 3 });
    await user.click(screen.getByText("prev"));
    expect(screen.getByTestId("current").textContent).toBe("2");
    await user.click(screen.getByText("prev"));
    expect(screen.getByTestId("current").textContent).toBe("1");
    await user.click(screen.getByText("prev"));
    expect(screen.getByTestId("current").textContent).toBe("1");
  });

  it("goToStep only navigates to reachable steps", async () => {
    const user = userEvent.setup();
    renderStepper();
    // step 3 is not reachable yet (step 2 not completed)
    await user.click(screen.getByText("goto3"));
    expect(screen.getByTestId("current").textContent).toBe("1");
    // out of range is ignored
    await user.click(screen.getByText("goto9"));
    expect(screen.getByTestId("current").textContent).toBe("1");
    // completing step 1 makes step 2 reachable
    await user.click(screen.getByText("next"));
    await user.click(screen.getByText("goto2"));
    expect(screen.getByTestId("current").textContent).toBe("2");
  });

  it("blocks navigation when isStepValid rejects the target step", async () => {
    const user = userEvent.setup();
    renderStepper({ isStepValid: () => false });
    await user.click(screen.getByText("next"));
    await user.click(screen.getByText("goto2"));
    // goToStep rejected, but nextStep had already advanced to 2
    expect(screen.getByTestId("current").textContent).toBe("2");
  });
});
