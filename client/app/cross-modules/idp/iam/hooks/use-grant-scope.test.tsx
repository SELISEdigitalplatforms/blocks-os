import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { grantScopeService } from "@blocks-idp/iam/services/grant-scope.service";
import { IGrantScope } from "@blocks-idp/iam/models/grant-scope";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGrantScope, useSystemOnlyReason } from "./use-grant-scope";

const h = vi.hoisted(() => ({
  user: { sub: "me", org_id: "org-1" } as { sub: string; org_id?: string } | null,
}));

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: h.user }),
}));
vi.mock("@blocks-idp/iam/services/grant-scope.service", () => ({
  grantScopeService: { getScope: vi.fn() },
}));

const limited: IGrantScope = {
  isSystemUser: false,
  heldRoles: ["lead"],
  managedRoles: ["member"],
  assignableRoles: ["member"],
  heldPermissions: ["read"],
};

describe("useGrantScope", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.user = { sub: "me", org_id: "org-1" };
  });

  it("limits a non-system caller", async () => {
    vi.mocked(grantScopeService.getScope).mockResolvedValue(limited);
    const { result } = renderHook(() => useGrantScope(), { wrapper: createWrapper() });

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
    vi.mocked(grantScopeService.getScope).mockResolvedValue({ ...limited, isSystemUser: true });
    const { result } = renderHook(() => useGrantScope(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRestricted).toBe(false);
    expect(result.current.canAssignRole("anything")).toBe(true);
    expect(result.current.canGrantPermission("anything")).toBe(true);
  });

  it("fails open when the endpoint errors, so older IAM builds keep working", async () => {
    vi.mocked(grantScopeService.getScope).mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useGrantScope(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRestricted).toBe(false);
    expect(result.current.canAssignRole("anything")).toBe(true);
  });

  it("still loads the scope when the token names no organization or there is no user", async () => {
    vi.mocked(grantScopeService.getScope).mockResolvedValue(limited);
    for (const user of [{ sub: "me" }, null]) {
      h.user = user;
      const { result } = renderHook(() => useGrantScope(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isRestricted).toBe(true));
    }
  });

  it("asks nothing and limits nothing while no project is selected", async () => {
    vi.mocked(useProjectStore).mockReturnValue({ selectedProject: undefined } as never);
    const { result } = renderHook(() => useGrantScope(), { wrapper: createWrapper() });

    expect(result.current.isRestricted).toBe(false);
    expect(grantScopeService.getScope).not.toHaveBeenCalled();
  });

  it("asks IAM once for several readers", async () => {
    vi.mocked(grantScopeService.getScope).mockResolvedValue(limited);
    const wrapper = createWrapper();
    const first = renderHook(() => useGrantScope(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(grantScopeService.getScope).toHaveBeenCalledTimes(1);
  });

  it("explains a system-only screen to a limited caller only", async () => {
    vi.mocked(grantScopeService.getScope).mockResolvedValue(limited);
    const { result } = renderHook(() => useSystemOnlyReason(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current).toBe("Only the system user can change this."));
  });
});
