import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useSettingsTenantId } from "./use-settings-tenant-id";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: vi.fn(),
}));

describe("useSettingsTenantId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the selected project's tenant id", () => {
    vi.mocked(useProjectStore).mockReturnValue({
      selectedProject: { tenantId: "tenant-42" },
    } as never);
    const { result } = renderHook(() => useSettingsTenantId());
    expect(result.current).toBe("tenant-42");
  });

  it("falls back to an empty string when no project is selected", () => {
    vi.mocked(useProjectStore).mockReturnValue({
      selectedProject: undefined,
    } as never);
    const { result } = renderHook(() => useSettingsTenantId());
    expect(result.current).toBe("");
  });
});
