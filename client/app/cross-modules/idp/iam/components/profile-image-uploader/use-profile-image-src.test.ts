import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  get: vi.fn(),
  logicBaseUrl: "https://logic.blocks.test" as string | undefined,
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => ({
  http: { get: (...args: unknown[]) => h.get(...args) },
}));
vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) => (key === "BLOCKS_LOGIC_BASE_URL" ? h.logicBaseUrl : undefined),
}));

import { useProfileImageSrc } from "./use-profile-image-src";

// A deferred promise lets a test observe the hook while the request is still
// in flight, which is the only way to reach the "cancelled" branch.
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.logicBaseUrl = "https://logic.blocks.test";
  h.createObjectURL.mockReturnValue("blob:object-url");
  Object.defineProperty(URL, "createObjectURL", {
    value: h.createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: h.revokeObjectURL,
    configurable: true,
  });
});

describe("useProfileImageSrc", () => {
  it("returns null and never fetches when no url is given", () => {
    const { result } = renderHook(() => useProfileImageSrc(undefined));
    expect(result.current).toBeNull();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("returns null and never fetches for an explicitly null url", () => {
    const { result } = renderHook(() => useProfileImageSrc(null));
    expect(result.current).toBeNull();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("passes an external CDN url straight through without an authenticated fetch", () => {
    const { result } = renderHook(() =>
      useProfileImageSrc("https://cdn.example.com/avatars/u1.png"),
    );
    expect(result.current).toBe("https://cdn.example.com/avatars/u1.png");
    expect(h.get).not.toHaveBeenCalled();
  });

  it("fetches a relative url through the authenticated client and exposes a blob url", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    h.get.mockResolvedValue(blob);

    const { result } = renderHook(() => useProfileImageSrc("/storage/avatars/u1.png"));

    expect(h.get).toHaveBeenCalledWith("/storage/avatars/u1.png", undefined, {
      absoluteUrl: true,
    });
    await waitFor(() => expect(result.current).toBe("blob:object-url"));
    expect(h.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it("fetches an absolute url that points at the logic service host", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    h.get.mockResolvedValue(blob);

    const { result } = renderHook(() =>
      useProfileImageSrc("https://logic.blocks.test/files/u1.png"),
    );

    expect(h.get).toHaveBeenCalledWith("https://logic.blocks.test/files/u1.png", undefined, {
      absoluteUrl: true,
    });
    await waitFor(() => expect(result.current).toBe("blob:object-url"));
  });

  it("stays null when the response is not a blob", async () => {
    h.get.mockResolvedValue({ notABlob: true });

    const { result } = renderHook(() => useProfileImageSrc("/storage/avatars/u1.png"));

    await waitFor(() => expect(h.get).toHaveBeenCalled());
    expect(result.current).toBeNull();
    expect(h.createObjectURL).not.toHaveBeenCalled();
  });

  it("stays null when the fetch rejects", async () => {
    h.get.mockRejectedValue(new Error("401"));

    const { result } = renderHook(() => useProfileImageSrc("/storage/avatars/u1.png"));

    await waitFor(() => expect(h.get).toHaveBeenCalled());
    await waitFor(() => expect(result.current).toBeNull());
    expect(h.createObjectURL).not.toHaveBeenCalled();
  });

  it("revokes the blob url when the consumer unmounts", async () => {
    h.get.mockResolvedValue(new Blob(["x"], { type: "image/png" }));

    const { result, unmount } = renderHook(() => useProfileImageSrc("/storage/avatars/u1.png"));
    await waitFor(() => expect(result.current).toBe("blob:object-url"));

    unmount();
    expect(h.revokeObjectURL).toHaveBeenCalledWith("blob:object-url");
  });

  it("revokes the previous blob url and refetches when the url changes", async () => {
    h.get.mockResolvedValue(new Blob(["x"], { type: "image/png" }));

    const { result, rerender } = renderHook(({ url }) => useProfileImageSrc(url), {
      initialProps: { url: "/storage/avatars/u1.png" },
    });
    await waitFor(() => expect(result.current).toBe("blob:object-url"));

    h.createObjectURL.mockReturnValue("blob:object-url-2");
    rerender({ url: "/storage/avatars/u2.png" });

    expect(h.revokeObjectURL).toHaveBeenCalledWith("blob:object-url");
    expect(h.get).toHaveBeenLastCalledWith("/storage/avatars/u2.png", undefined, {
      absoluteUrl: true,
    });
    await waitFor(() => expect(result.current).toBe("blob:object-url-2"));
  });

  it("ignores a response that arrives after unmount", async () => {
    const pending = deferred<Blob>();
    h.get.mockReturnValue(pending.promise);

    const { unmount } = renderHook(() => useProfileImageSrc("/storage/avatars/u1.png"));
    unmount();

    pending.resolve(new Blob(["x"], { type: "image/png" }));
    await pending.promise;
    expect(h.createObjectURL).not.toHaveBeenCalled();
  });

  it("ignores a rejection that arrives after unmount", async () => {
    const pending = deferred<Blob>();
    h.get.mockReturnValue(pending.promise);

    const { unmount } = renderHook(() => useProfileImageSrc("/storage/avatars/u1.png"));
    unmount();

    pending.reject(new Error("401"));
    await pending.promise.catch(() => undefined);
    expect(h.revokeObjectURL).not.toHaveBeenCalled();
  });

  // The logic hostname is derived by parsing BLOCKS_LOGIC_BASE_URL. When that
  // variable is not configured the parse throws and the hostname falls back to the
  // empty string. Guarding on that keeps external CDN urls on the direct path
  // instead of sending them through the authenticated client, which would fail.
  it("still passes an external CDN url through when the logic base url is not configured", () => {
    h.logicBaseUrl = undefined;

    const { result } = renderHook(() =>
      useProfileImageSrc("https://cdn.example.com/avatars/u1.png"),
    );

    expect(h.get).not.toHaveBeenCalled();
    expect(result.current).toBe("https://cdn.example.com/avatars/u1.png");
  });

  it("still fetches a relative url when the logic base url is not configured", async () => {
    h.logicBaseUrl = undefined;
    h.get.mockResolvedValue(new Blob(["x"], { type: "image/png" }));

    const { result } = renderHook(() => useProfileImageSrc("/api/logic/storage/u1.png"));

    expect(h.get).toHaveBeenCalledWith("/api/logic/storage/u1.png", undefined, {
      absoluteUrl: true,
    });
    await waitFor(() => expect(result.current).toBe("blob:object-url"));
  });
});
