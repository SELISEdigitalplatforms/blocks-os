/**
 * What archiving a role or permission would actually affect, across every organization.
 *
 * Read-only and current-at-open: the backend deliberately does not lock anything, so a user
 * assigned the role between opening this dialog and confirming is still revoked. Copy built from
 * these numbers must therefore describe them as current, never as a guarantee.
 */
export interface IArchiveImpactBase {
  isSuccess: boolean;
  name: string;
  isMultiOrgEnabled: boolean;
  /** Organizations affected OTHER than the target's own, so "N other organizations" reads right. */
  organizationCount: number;
  /**
   * Distinct users who lose this. Unfiltered by user state, because the backend scrub is itself
   * unfiltered -- consent is required whenever this is above zero, not only when someone active
   * holds it.
   */
  affectedUserCount: number;
  /** True when no consent can make the archive proceed. */
  blocked: boolean;
  blockingReason: string | null;
}

export interface IRoleArchiveImpact extends IArchiveImpactBase {
  slug: string;
  /** Subset of affectedUserCount that is genuinely active -- the live access being revoked. */
  activeUserCount: number;
}

export interface IPermissionArchiveImpact extends IArchiveImpactBase {
  resource: string;
  /**
   * Distinct roles referencing this permission. A separate population from affectedUserCount,
   * which counts direct per-user grants -- only the latter mints a token claim.
   */
  roleBindingCount: number;
}
