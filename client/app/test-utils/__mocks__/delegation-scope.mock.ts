/**
 * Test double for `@blocks-idp/iam/hooks/use-delegation-scope`: an unlimited caller (the system
 * user), so screens render exactly as they did before delegated administration. The real hook reads
 * React Query and the project store, which most component tests do not set up.
 *
 * Usage, at the top of a test file:
 *   vi.mock("@blocks-idp/iam/hooks/use-delegation-scope", () => import("@/test-utils/__mocks__/delegation-scope.mock"));
 */
/** A test that wants the limited case sets `systemOnlyReason` (and resets it in `beforeEach`). */
export const delegation = { systemOnlyReason: undefined as string | undefined };

export const resetDelegation = () => {
  delegation.systemOnlyReason = undefined;
};

export const useDelegationScope = () => ({
  scope: undefined,
  isLoading: false,
  isRestricted: false,
  assignableRoles: [] as string[],
  heldPermissions: [] as string[],
  managedByCandidates: [] as string[],
  canAssignRole: () => true,
  canGrantPermission: () => true,
});

export const useSystemOnlyReason = (): string | undefined => delegation.systemOnlyReason;
