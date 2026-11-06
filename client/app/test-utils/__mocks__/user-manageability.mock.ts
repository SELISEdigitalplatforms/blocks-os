/**
 * Test double for `@blocks-idp/iam/hooks/use-user-manageability`. By default every user may be
 * managed. A test that wants the limited case changes `manageability` (and calls
 * `resetManageability()` in `beforeEach`).
 *
 * Usage, at the top of a test file:
 *   vi.mock("@blocks-idp/iam/hooks/use-user-manageability", () => import("@/test-utils/__mocks__/user-manageability.mock"));
 */
export const manageability = {
  /** User ids the caller may not manage. */
  blockedIds: new Set<string>(),
  /** The caller's own id; role edits on it are refused. */
  selfId: undefined as string | undefined,
};

export const resetManageability = () => {
  manageability.blockedIds = new Set();
  manageability.selfId = undefined;
};

export const useUserManageability = () => ({
  isRestricted: manageability.blockedIds.size > 0 || manageability.selfId !== undefined,
  isSelf: (userId: string) => manageability.selfId === userId,
  canManage: (user: { itemId?: string } | undefined) =>
    !(user?.itemId && manageability.blockedIds.has(user.itemId)),
});
