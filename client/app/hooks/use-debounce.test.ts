import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./use-debounce";

describe("useDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("a", 500));
    expect(result.current).toBe("a");
  });

  it("updates the value only after the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe("b");
  });

  it("resets the timer when the value changes before the delay completes", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => vi.advanceTimersByTime(200));

    rerender({ value: "c" });
    act(() => vi.advanceTimersByTime(200));
    // 200ms after the last change is still short of the 300ms delay.
    expect(result.current).toBe("a");

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe("c");
  });
});
