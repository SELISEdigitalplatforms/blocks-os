import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { delegationService } from "@blocks-idp/iam/services/delegation.service";
import { IDelegationScope } from "@blocks-idp/iam/models/delegation-scope";
import { useDelegationScope, useSystemOnlyReason } from "./use-delegation-scope";

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: { sub: "me", org_id: "org-1" } }),
}));
vi.mock("@blocks-idp/iam/services/delegation.service", () => ({
  delegationService: { getScope: vi.fn() },
}));

const limited: IDelegationScope = {
  isSystemUser: false,
  mode: "Enforce",
  heldRoles: ["lead"],
  managedRoles: ["member"],
  assignableRoles: ["member"],
  heldPermissions: ["read"],
};

describe("useDelegationScope", () => {
  beforeEach(() => vi.resetAllMocks());

  it("limits a non-system caller in Enforce mode", async () => {
    vi.mocked(delegationService.getScope).mockResolvedValue(limited);
    const { result } = renderHook(() => useDelegationScope(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRestricted).toBe(true);
    expect(result.current.assignableRoles).toEqual(["member"]);
    expect(result.current.managedByCandidates).toEqual(["lead", "member"]);
    expect(result.current.canAssignRole("member")).toBe(true);
    expect(result.current.canAssignRole("admin")).toBe(false);
    expect(result.current.canGrantPermission("read")).toBe(true);
    expect(result.current.canGrantPermission("write")).toBe(false);
  });

  it("leaves the system user unlimited", async () => {
    vi.mocked(delegationService.getScope).mockResolvedValue({ ...limited, isSystemUser: true });
    const { result } = renderHook(() => useDelegationScope(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRestricted).toBe(false);
    expect(result.current.canAssignRole("anything")).toBe(true);
    expect(result.current.canGrantPermission("anything")).toBe(true);
  });

  it("does not limit anything in Audit mode", async () => {
    vi.mocked(delegationService.getScope).mockResolvedValue({ ...limited, mode: "Audit" });
    const { result } = renderHook(() => useDelegationScope(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRestricted).toBe(false);
  });

  it("fails open when the endpoint errors, so older IAM builds keep working", async () => {
    vi.mocked(delegationService.getScope).mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useDelegationScope(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRestricted).toBe(false);
    expect(result.current.canAssignRole("anything")).toBe(true);
  });

  it("asks IAM once for several readers", async () => {
    vi.mocked(delegationService.getScope).mockResolvedValue(limited);
    const wrapper = createWrapper();
    const first = renderHook(() => useDelegationScope(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(delegationService.getScope).toHaveBeenCalledTimes(1);
  });

  it("explains a system-only screen to a limited caller only", async () => {
    vi.mocked(delegationService.getScope).mockResolvedValue(limited);
    const { result } = renderHook(() => useSystemOnlyReason(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toBe("Only the system user can change this."));
  });
});
