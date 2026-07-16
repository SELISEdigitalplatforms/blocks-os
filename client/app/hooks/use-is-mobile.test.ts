import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import useIsMobile from "./use-is-mobile";

const originalWidth = window.innerWidth;

const setWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
};

describe("useIsMobile", () => {
  afterEach(() => setWidth(originalWidth));

  it("returns true when the viewport is at or below the breakpoint", () => {
    setWidth(500);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when the viewport is wider than the breakpoint", () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when a resize event fires", () => {
    setWidth(1200);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setWidth(400);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);
  });

  it("honours a custom breakpoint", () => {
    setWidth(900);
    const { result } = renderHook(() => useIsMobile(1000));
    expect(result.current).toBe(true);
  });
});
