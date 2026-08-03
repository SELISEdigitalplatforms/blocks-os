import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationListener } from "./use-notification-listener";

describe("useNotificationListener", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("invokes the callback with the event detail when the event fires", () => {
    const cb = vi.fn();
    renderHook(() => useNotificationListener("my-event", cb));
    window.dispatchEvent(new CustomEvent("my-event", { detail: { foo: "bar" } }));
    expect(cb).toHaveBeenCalledWith({ foo: "bar" });
  });

  it("removes the listener on unmount", () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useNotificationListener("evt", cb));
    unmount();
    window.dispatchEvent(new CustomEvent("evt", { detail: 1 }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("re-subscribes to the new event name when it changes", () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ name }) => useNotificationListener(name, cb), {
      initialProps: { name: "a" },
    });

    rerender({ name: "b" });

    window.dispatchEvent(new CustomEvent("a", { detail: "old" }));
    expect(cb).not.toHaveBeenCalled();

    window.dispatchEvent(new CustomEvent("b", { detail: "new" }));
    expect(cb).toHaveBeenCalledWith("new");
  });
});
