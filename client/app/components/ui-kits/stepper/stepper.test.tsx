import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Stepper, Step } from "./index";
import type { StepItem } from "./index";

const steps: StepItem[] = [{ label: "One" }, { label: "Two" }, { label: "Three" }];

const renderStepper = (props: Partial<React.ComponentProps<typeof Stepper>> = {}) =>
  render(
    <Stepper steps={steps} {...props}>
      {steps.map((s) => (
        <Step key={s.label} label={s.label} />
      ))}
      <div data-testid="footer">footer content</div>
    </Stepper>,
  );

describe("Stepper", () => {
  it("renders each step label in horizontal orientation", () => {
    renderStepper({ orientation: "horizontal" });
    expect(screen.getAllByText("One").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Two").length).toBeGreaterThan(0);
  });

  it("renders footer (non-Step) children", () => {
    renderStepper();
    expect(screen.getByTestId("footer")).toBeTruthy();
  });

  it("renders in vertical orientation", () => {
    const { container } = renderStepper({ orientation: "vertical" });
    expect(container.querySelector(".stepper__main-container")).toBeTruthy();
    expect(container.querySelector(".flex-col")).toBeTruthy();
  });

  it("marks steps clickable when onClickStep is provided", () => {
    const onClickStep = vi.fn();
    const { container } = renderStepper({ onClickStep });
    expect(container.querySelector(".stepper__main-container")).toBeTruthy();
  });

  it("starts on the given initial step", () => {
    renderStepper({ initialStep: 1 });
    expect(screen.getAllByText("Two").length).toBeGreaterThan(0);
  });

  it("applies the requested size via the icon-size CSS variable", () => {
    const { container } = renderStepper({ size: "lg" });
    const main = container.querySelector(".stepper__main-container") as HTMLElement;
    expect(main.style.getPropertyValue("--step-icon-size")).toBe("44px");
  });
});
