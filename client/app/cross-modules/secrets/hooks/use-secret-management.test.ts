import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { secretManagementService } from "@/cross-modules/secrets/services/secret-management.service";
import { SECRET_STATUS, SECRET_TYPE } from "@/cross-modules/secrets/models/secret.model";
import {
  FakeHttpError,
  SECRET_ID,
  makeSecret,
} from "@/cross-modules/secrets/test-utils/secret.fixtures";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import {
  secretQueryKeys,
  useDeleteSecret,
  useFindSecrets,
  useGetSecret,
  useLockSecret,
  useRestoreSecret,
  useRevealSecret,
  useRotateSecret,
  useSecretAuditLogs,
  useSetSecret,
  useUnlockSecret,
  useUpdateSecret,
  useUpdateSecretAccess,
} from "./use-secret-management";

vi.mock("@seliseblocks/genesis-os", () => mockProjectStoreFactory());
vi.mock("@/cross-modules/secrets/services/secret-management.service", () => ({
  secretManagementService: {
    find: vi.fn(),
    get: vi.fn(),
    getValue: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    updateAccess: vi.fn(),
    rotate: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    getAuditLogs: vi.fn(),
  },
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

const TENANT = "test-tenant-id-123";

describe("secret query keys", () => {
  it("scopes every key to the active tenant", () => {
    // The endpoints resolve the tenant from the token, so the same URL returns different data
    // per project. Without the tenant in the key, switching projects serves the wrong cache.
    expect(secretQueryKeys.list(TENANT)).toEqual(["secrets", "list", TENANT]);
    expect(secretQueryKeys.item(TENANT, "s-1")).toEqual(["secrets", "item", TENANT, "s-1"]);
    expect(secretQueryKeys.audit(TENANT, "s-1", { pageNumber: 1 })).toEqual([
      "secrets",
      "audit",
      TENANT,
      "s-1",
      { pageNumber: 1 },
    ]);
  });
});

describe("useFindSecrets", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes the filter straight to the list endpoint", async () => {
    vi.mocked(secretManagementService.find).mockResolvedValue({ data: [], totalCount: 0 });
    const filter = { search: "gateway", type: SECRET_TYPE.Api, pageNumber: 1, pageSize: 10 };

    const { result } = renderHook(() => useFindSecrets(filter), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(secretManagementService.find).toHaveBeenCalledWith(filter);
    expect(secretManagementService.get).not.toHaveBeenCalled();
  });

  it("fetches by id when the search text is id-shaped", async () => {
    // SecretFilter.Search matches name and description only, so a pasted id finds nothing.
    const secret = makeSecret();
    vi.mocked(secretManagementService.get).mockResolvedValue(secret);

    const { result } = renderHook(() => useFindSecrets({ search: SECRET_ID }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(secretManagementService.get).toHaveBeenCalledWith(SECRET_ID);
    expect(secretManagementService.find).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({ data: [secret], totalCount: 1 });
  });

  it("still honours the type and status filters on the id path", async () => {
    vi.mocked(secretManagementService.get).mockResolvedValue(
      makeSecret({ status: SECRET_STATUS.Active }),
    );

    const { result } = renderHook(
      () => useFindSecrets({ search: SECRET_ID, status: SECRET_STATUS.Locked }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: [], totalCount: 0 });
  });

  it("renders an unknown id as an empty list rather than an error", async () => {
    vi.mocked(secretManagementService.get).mockRejectedValue(new FakeHttpError(404, {}));

    const { result } = renderHook(() => useFindSecrets({ search: SECRET_ID }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: [], totalCount: 0 });
  });

  it("surfaces non-404 failures on the id path", async () => {
    vi.mocked(secretManagementService.get).mockRejectedValue(new FakeHttpError(502, {}));

    const { result } = renderHook(() => useFindSecrets({ search: SECRET_ID }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("can be disabled", () => {
    const { result } = renderHook(() => useFindSecrets({}, false), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(secretManagementService.find).not.toHaveBeenCalled();
  });
});

describe("useGetSecret", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches a secret by id", async () => {
    vi.mocked(secretManagementService.get).mockResolvedValue(makeSecret());
    const { result } = renderHook(() => useGetSecret(SECRET_ID), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(secretManagementService.get).toHaveBeenCalledWith(SECRET_ID);
  });

  it("stays idle without an id", () => {
    const { result } = renderHook(() => useGetSecret(""), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useRevealSecret", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the value through a mutation, not a query", async () => {
    // A query would cache plaintext and refetch it on window focus, writing GetValue audit
    // rows nobody asked for.
    vi.mocked(secretManagementService.getValue).mockResolvedValue({
      secretId: SECRET_ID,
      value: "shh",
    });

    const { result } = renderHook(() => useRevealSecret(), { wrapper: createWrapper() });

    expect(secretManagementService.getValue).not.toHaveBeenCalled();
    const response = await result.current.mutateAsync(SECRET_ID);
    expect(response.value).toBe("shh");
    expect(secretManagementService.getValue).toHaveBeenCalledTimes(1);
  });

  it("reports a conflict when the secret is locked", async () => {
    vi.mocked(secretManagementService.getValue).mockRejectedValue(
      new FakeHttpError(409, { invalid_state: "locked", reason: "STATUS_LOCKED" }),
    );

    const { result } = renderHook(() => useRevealSecret(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync(SECRET_ID)).rejects.toBeInstanceOf(FakeHttpError);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});

describe("mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a secret and reports success", async () => {
    vi.mocked(secretManagementService.set).mockResolvedValue({ secretId: SECRET_ID });
    const { result } = renderHook(() => useSetSecret(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      name: "n",
      value: "v",
      type: SECRET_TYPE.Service,
      access: null,
    });

    expect(secretManagementService.set).toHaveBeenCalledWith({
      name: "n",
      value: "v",
      type: "service",
      access: null,
    });
    expect(showSuccessToast).toHaveBeenCalledWith({ description: "Secret created." });
  });

  it("does not toast on create failure — the form shows a field error instead", async () => {
    vi.mocked(secretManagementService.set).mockRejectedValue(
      new FakeHttpError(400, { reason: "NAME_TAKEN" }),
    );
    const { result } = renderHook(() => useSetSecret(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({ name: "n", value: "v", type: SECRET_TYPE.Api }),
    ).rejects.toBeInstanceOf(FakeHttpError);
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("updates metadata only", async () => {
    vi.mocked(secretManagementService.update).mockResolvedValue({ isSuccess: true });
    const { result } = renderHook(() => useUpdateSecret(), { wrapper: createWrapper() });

    await result.current.mutateAsync({ secretId: SECRET_ID, name: "renamed" });

    expect(secretManagementService.update).toHaveBeenCalledWith(SECRET_ID, { name: "renamed" });
  });

  it("updates access through the dedicated endpoint", async () => {
    vi.mocked(secretManagementService.updateAccess).mockResolvedValue({ isSuccess: true });
    const { result } = renderHook(() => useUpdateSecretAccess(), { wrapper: createWrapper() });

    const access = { userIds: ["u-1"], roles: ["admin"] };
    await result.current.mutateAsync({ secretId: SECRET_ID, access });

    expect(secretManagementService.updateAccess).toHaveBeenCalledWith(SECRET_ID, access);
  });

  it.each([
    ["rotate", useRotateSecret, "rotate", "Secret rotated."],
    ["lock", useLockSecret, "lock", "Secret locked."],
    ["unlock", useUnlockSecret, "unlock", "Secret unlocked."],
    ["restore", useRestoreSecret, "restore", "Secret restored."],
  ] as const)("%s reports success", async (_label, hook, method, description) => {
    vi.mocked(secretManagementService[method]).mockResolvedValue({ isSuccess: true });
    const { result } = renderHook(() => hook(), { wrapper: createWrapper() });

    await result.current.mutateAsync(
      method === "rotate" ? ({ secretId: SECRET_ID, value: "next" } as never) : (SECRET_ID as never),
    );

    expect(showSuccessToast).toHaveBeenCalledWith({ description });
  });

  it("says a deleted secret can be restored", async () => {
    // The backend keeps the vault value so restore can bring it back; calling it permanent
    // would be false.
    vi.mocked(secretManagementService.remove).mockResolvedValue({ isSuccess: true });
    const { result } = renderHook(() => useDeleteSecret(), { wrapper: createWrapper() });

    await result.current.mutateAsync(SECRET_ID);

    expect(showSuccessToast).toHaveBeenCalledWith({
      description: "Secret deleted. It can still be restored.",
    });
  });

  it("toasts a readable message when a lifecycle call fails", async () => {
    vi.mocked(secretManagementService.lock).mockRejectedValue(new FakeHttpError(403, {}));
    const { result } = renderHook(() => useLockSecret(), { wrapper: createWrapper() });

    await expect(result.current.mutateAsync(SECRET_ID)).rejects.toBeInstanceOf(FakeHttpError);
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({
        errors: expect.stringMatching(/do not have permission/i),
      }),
    );
  });
});

describe("useSecretAuditLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches the audit page for a secret", async () => {
    vi.mocked(secretManagementService.getAuditLogs).mockResolvedValue({ data: [], totalCount: 0 });
    const filter = { secretId: SECRET_ID, pageNumber: 1, pageSize: 10 };

    const { result } = renderHook(() => useSecretAuditLogs(filter), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(secretManagementService.getAuditLogs).toHaveBeenCalledWith(filter);
  });

  it("stays idle without a secret id", () => {
    const { result } = renderHook(() => useSecretAuditLogs({ secretId: "" }), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
