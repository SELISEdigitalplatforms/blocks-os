import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { githubInfoService } from "../services/github-info.service";
import { useRevokeAccess } from "./github-info";

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("../services/github-info.service", () => ({
  githubInfoService: {
    revokeAccess: vi.fn(),
  },
}));

describe("github-info hooks (extra)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("useRevokeAccess stays idle until explicitly triggered", () => {
    const { result } = renderHook(() => useRevokeAccess(), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(githubInfoService.revokeAccess).not.toHaveBeenCalled();
  });
});
