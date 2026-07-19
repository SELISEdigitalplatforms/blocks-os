import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import usePopoverWidth from "./use-popover-width";

describe("usePopoverWidth", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns a ref and an initially undefined width", () => {
    const { result } = renderHook(() => usePopoverWidth());
    const [ref, width] = result.current;
    expect(ref).toHaveProperty("current");
    expect(width).toBeUndefined();
  });

  it("measures offsetWidth when the ref is attached", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { result } = renderHook(() => usePopoverWidth());
    // The hook subscribes to window resize events.
    expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(result.current[0]).toHaveProperty("current");
  });

  it("removes the resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => usePopoverWidth());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
