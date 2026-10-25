/**
 * Test double for `@blocks-idp/iam/hooks/use-grant-scope`: an unlimited caller (the system
 * user), so screens render exactly as they did before the access grant feature. The real hook reads
 * React Query and the project store, which most component tests do not set up.
 *
 * Usage, at the top of a test file:
 *   vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => import("@/test-utils/__mocks__/grant-scope.mock"));
 */
/** A test that wants the limited case sets `systemOnlyReason` (and resets it in `beforeEach`). */
export const grant = { systemOnlyReason: undefined as string | undefined };

export const resetGrant = () => {
  grant.systemOnlyReason = undefined;
};

export const useGrantScope = () => ({
  scope: undefined,
  isLoading: false,
  isRestricted: false,
  assignableRoles: [] as string[],
  heldPermissions: [] as string[],
  managedByCandidates: [] as string[],
  canAssignRole: () => true,
  canGrantPermission: () => true,
});

export const useSystemOnlyReason = (): string | undefined => grant.systemOnlyReason;
