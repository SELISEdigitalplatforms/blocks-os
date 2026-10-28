import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockUserServiceFactory, MOCK_USER_ITEM_ID } from "../../test-utils/__mocks__";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__";
import { userService } from "@blocks-idp/iam/services/user.service";
import {
  useAddUser,
  useCheckUserExists,
  useRevokeAccess,
  useUpdateUser,
  useUpdateUserAccessControl,
} from "./use-user";

vi.mock("@blocks-idp/iam/services/user.service", () => mockUserServiceFactory());

vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: vi.fn(() => ({ setUser: vi.fn() })),
}));

const EMAIL = "member@blocks.com";
const FIRST_ORG = "org-first";
const SECOND_ORG = "org-second";

// The invite dialogs mount `useCheckUserExists` while open and drop it when
// closed. Keep the cache across the close (the app's default gcTime) so a
// reopen within the 30 s staleTime reuses the cached answer, as in the app.
const createSharedClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

type Wrapper = ReturnType<typeof createSharedClient>["wrapper"];

/** Opens the dialog, waits for the existence check to settle, then closes it. */
const checkExistenceInDialog = async (wrapper: Wrapper, email = EMAIL) => {
  const { result, unmount } = renderHook(() => useCheckUserExists(email), { wrapper });
  // Read both flags on every render, as the dialogs do. The hook only re-renders
  // for props it has seen read, and a reopen starts out already `isSuccess`.
  await waitFor(() => {
    expect(result.current.isFetching).toBe(false);
    expect(result.current.isSuccess).toBe(true);
  });
  const data = result.current.data;
  unmount();
  return data;
};

describe("useCheckUserExists cache after user and membership mutations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("refetches the existence check after inviting the user, so a reopen within 30 s shows the user as existing", async () => {
    const { wrapper } = createSharedClient();
    vi.mocked(userService.isUserExist)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ userId: MOCK_USER_ITEM_ID, organizationIds: [FIRST_ORG] });
    vi.mocked(userService.addUser).mockResolvedValue({ isSuccess: true } as never);

    expect((await checkExistenceInDialog(wrapper))?.userId).toBeUndefined();

    const { result: addUser } = renderHook(() => useAddUser(), { wrapper });
    await act(() =>
      addUser.current.mutateAsync({
        email: ` ${EMAIL.toUpperCase()} `,
        firstName: "",
        lastName: "",
        userPassType: 1,
        userCreationType: 1,
        platform: "blocks_portal",
        projectKey: TEST_PROJECT_KEY,
        organizationId: FIRST_ORG,
      }),
    );

    const after = await checkExistenceInDialog(wrapper);
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);
    expect(after?.userId).toBe(MOCK_USER_ITEM_ID);
  });

  it("only refetches the invited email's existence check after inviting a user", async () => {
    const { wrapper } = createSharedClient();
    vi.mocked(userService.isUserExist).mockResolvedValue({});
    vi.mocked(userService.addUser).mockResolvedValue({ isSuccess: true } as never);

    await checkExistenceInDialog(wrapper, EMAIL);
    await checkExistenceInDialog(wrapper, "someone-else@blocks.com");
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);

    const { result: addUser } = renderHook(() => useAddUser(), { wrapper });
    await act(() =>
      addUser.current.mutateAsync({
        email: EMAIL,
        firstName: "",
        lastName: "",
        userPassType: 1,
        userCreationType: 1,
        platform: "blocks_portal",
        projectKey: TEST_PROJECT_KEY,
      }),
    );

    await checkExistenceInDialog(wrapper, "someone-else@blocks.com");
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);
    await checkExistenceInDialog(wrapper, EMAIL);
    expect(userService.isUserExist).toHaveBeenCalledTimes(3);
  });

  it("refetches the existence check after granting access, so a reopen within 30 s sees the new membership", async () => {
    const { wrapper } = createSharedClient();
    vi.mocked(userService.isUserExist)
      .mockResolvedValueOnce({ userId: MOCK_USER_ITEM_ID, organizationIds: [FIRST_ORG] })
      .mockResolvedValueOnce({
        userId: MOCK_USER_ITEM_ID,
        organizationIds: [FIRST_ORG, SECOND_ORG],
      });
    vi.mocked(userService.updateUserAccessControl).mockResolvedValue({ isSuccess: true } as never);

    expect((await checkExistenceInDialog(wrapper))?.organizationIds).toEqual([FIRST_ORG]);

    const { result: grant } = renderHook(
      () => useUpdateUserAccessControl({ id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }),
      { wrapper },
    );
    await act(() =>
      grant.current.mutateAsync({
        organizationId: SECOND_ORG,
        roles: [],
        permissions: [],
        notifyUser: true,
      }),
    );

    const after = await checkExistenceInDialog(wrapper);
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);
    expect(after?.organizationIds).toEqual([FIRST_ORG, SECOND_ORG]);
  });

  it("refetches the existence check after revoking access, so re-adding within 30 s is not blocked as already assigned", async () => {
    const { wrapper } = createSharedClient();
    vi.mocked(userService.isUserExist)
      .mockResolvedValueOnce({
        userId: MOCK_USER_ITEM_ID,
        organizationIds: [FIRST_ORG, SECOND_ORG],
      })
      .mockResolvedValueOnce({ userId: MOCK_USER_ITEM_ID, organizationIds: [FIRST_ORG] });
    vi.mocked(userService.revokeAccess).mockResolvedValue({ isSuccess: true } as never);

    await checkExistenceInDialog(wrapper);

    const { result: revoke } = renderHook(() => useRevokeAccess({ id: MOCK_USER_ITEM_ID }), {
      wrapper,
    });
    await act(() =>
      revoke.current.mutateAsync({ organizationId: SECOND_ORG, notifyUser: false }),
    );

    const after = await checkExistenceInDialog(wrapper);
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);
    expect(after?.organizationIds).toEqual([FIRST_ORG]);
  });

  it("refetches the existence check after a user update, which can change email or organizations", async () => {
    const { wrapper } = createSharedClient();
    vi.mocked(userService.isUserExist)
      .mockResolvedValueOnce({ userId: MOCK_USER_ITEM_ID, organizationIds: [FIRST_ORG] })
      .mockResolvedValueOnce({ userId: MOCK_USER_ITEM_ID, organizationIds: [SECOND_ORG] });
    vi.mocked(userService.updateUser).mockResolvedValue({ isSuccess: true } as never);

    await checkExistenceInDialog(wrapper);

    const { result: update } = renderHook(
      () => useUpdateUser({ id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }),
      { wrapper },
    );
    await act(() =>
      update.current.mutateAsync({ itemId: MOCK_USER_ITEM_ID, organizationIds: [SECOND_ORG] }),
    );

    const after = await checkExistenceInDialog(wrapper);
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);
    expect(after?.organizationIds).toEqual([SECOND_ORG]);
  });

  it("refetches an open dialog's existence check immediately when a mutation succeeds", async () => {
    const { wrapper } = createSharedClient();
    vi.mocked(userService.isUserExist)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ userId: MOCK_USER_ITEM_ID, organizationIds: [FIRST_ORG] });
    vi.mocked(userService.updateUserAccessControl).mockResolvedValue({ isSuccess: true } as never);

    const { result } = renderHook(() => useCheckUserExists(EMAIL), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.userId).toBeUndefined();

    const { result: grant } = renderHook(
      () => useUpdateUserAccessControl({ id: MOCK_USER_ITEM_ID, projectKey: TEST_PROJECT_KEY }),
      { wrapper },
    );
    await act(() =>
      grant.current.mutateAsync({
        organizationId: FIRST_ORG,
        roles: [],
        permissions: [],
        notifyUser: true,
      }),
    );

    await waitFor(() => expect(result.current.data?.userId).toBe(MOCK_USER_ITEM_ID));
    expect(userService.isUserExist).toHaveBeenCalledTimes(2);
  });
});
