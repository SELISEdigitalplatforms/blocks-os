import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

const setClipboard = (impl?: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: impl ? { writeText: vi.fn(impl) } : undefined,
  });
};

describe("useCopyToClipboard", () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.useRealTimers();
  });

  it("writes to the clipboard and calls onSuccess", async () => {
    setClipboard(() => Promise.resolve());
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello", onSuccess);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(onSuccess).toHaveBeenCalled();
  });

  it("calls onError when the clipboard API is unavailable", async () => {
    setClipboard(undefined);
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hi", undefined, onError);
    });

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("calls onError when writeText rejects", async () => {
    setClipboard(() => Promise.reject(new Error("denied")));
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hi", undefined, onError);
    });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0].message).toBe("denied");
  });
});
