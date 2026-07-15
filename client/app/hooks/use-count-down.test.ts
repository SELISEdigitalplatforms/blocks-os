import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountDown } from "./use-count-down";

describe("useCountDown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("counts down once per second", () => {
    const { result } = renderHook(() => useCountDown(3));
    expect(result.current.remainingTime).toBe(3);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingTime).toBe(2);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.remainingTime).toBe(0);
  });

  it("stops ticking once it reaches zero", () => {
    const { result } = renderHook(() => useCountDown(1));
    // Advance one second at a time so the effect can re-run and clear the interval.
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingTime).toBe(0);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.remainingTime).toBe(0);
  });

  it("reset restores the initial value", () => {
    const { result } = renderHook(() => useCountDown(2));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.remainingTime).toBe(0);
    act(() => result.current.reset());
    expect(result.current.remainingTime).toBe(2);
  });

  it("reset accepts an explicit value", () => {
    const { result } = renderHook(() => useCountDown(2));
    act(() => result.current.reset(10));
    expect(result.current.remainingTime).toBe(10);
  });
});
