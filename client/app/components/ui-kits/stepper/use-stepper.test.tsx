import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { useStepper } from "./use-stepper";
import { StepperContext } from "./context";

const makeWrapper = (activeStep: number, steps: unknown[]) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    const value = {
      steps,
      activeStep,
      initialStep: 0,
      nextStep: () => {},
      prevStep: () => {},
      resetSteps: () => {},
      setStep: () => {},
    } as never;
    return <StepperContext.Provider value={value}>{children}</StepperContext.Provider>;
  };

const steps = [{ label: "One" }, { label: "Two", optional: true }, { label: "Three" }];

describe("useStepper", () => {
  it("reports the first step as disabled and not last", () => {
    const { result } = renderHook(() => useStepper(), {
      wrapper: makeWrapper(0, steps),
    });
    expect(result.current.isDisabledStep).toBe(true);
    expect(result.current.isLastStep).toBe(false);
    expect(result.current.isOptionalStep).toBe(false);
    expect(result.current.currentStep).toEqual({ label: "One" });
  });

  it("flags an optional current step", () => {
    const { result } = renderHook(() => useStepper(), {
      wrapper: makeWrapper(1, steps),
    });
    expect(result.current.isOptionalStep).toBe(true);
    expect(result.current.isDisabledStep).toBe(false);
  });

  it("reports the last step", () => {
    const { result } = renderHook(() => useStepper(), {
      wrapper: makeWrapper(2, steps),
    });
    expect(result.current.isLastStep).toBe(true);
    expect(result.current.hasCompletedAllSteps).toBe(false);
  });

  it("detects completion when activeStep passes the last index", () => {
    const { result } = renderHook(() => useStepper(), {
      wrapper: makeWrapper(3, steps),
    });
    expect(result.current.hasCompletedAllSteps).toBe(true);
  });
});
