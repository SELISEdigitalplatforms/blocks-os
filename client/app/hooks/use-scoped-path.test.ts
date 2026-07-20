import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLmtBasePath, useScopedPath } from "./use-scoped-path";

const pathBuilder = vi.fn((segment: string) => `/app/proj-1/${segment}`);

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: vi.fn(() => pathBuilder),
}));

describe("use-scoped-path", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useLmtBasePath scopes the lmt segment to the active project id", () => {
    const { result } = renderHook(() => useLmtBasePath());
    expect(pathBuilder).toHaveBeenCalledWith("lmt");
    expect(result.current).toBe("/app/proj-1/lmt");
  });

  it("re-exports useScopedPath from blocks-kit", () => {
    const { result } = renderHook(() => useScopedPath()("settings"));
    expect(result.current).toBe("/app/proj-1/settings");
  });
});
