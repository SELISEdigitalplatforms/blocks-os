/**
 * What applying a pending permission diff to a role would affect.
 *
 * Read-only and current-at-open, exactly like {@link IArchiveImpactBase}: the backend locks
 * nothing, so a user granted the role between opening the dialog and confirming is still affected.
 * Copy built from these numbers must describe them as current, never as a guarantee.
 */
export interface IRolePermissionChangeImpact {
  isSuccess: boolean;
  slug: string;
  /** Display name of the role the diff applies to. */
  name: string;
  isMultiOrgEnabled: boolean;
  /**
   * Whether the "apply to all organizations" option may be offered at all. The backend computes
   * this from the same gate it enforces on the write -- multi-org on AND this is the default
   * organization's copy of the role -- so the client never has to re-derive the rule and cannot
   * drift from it.
   */
  canPropagate: boolean;
  /** Permissions in the diff that actually resolve to a document. */
  addCount: number;
  removeCount: number;
  /** Organizations affected OTHER than this role's own, so "N other organizations" reads right. */
  organizationCount: number;
  /**
   * Organizations propagation would silently skip, because their copy of the role is missing or
   * archived. Shown rather than swallowed -- this drift is the reason the feature exists.
   */
  skippedOrganizationCount: number;
  /** Distinct users currently holding this role across the counted organizations. */
  affectedUserCount: number;
  /** Subset of affectedUserCount that is genuinely active -- the live access being changed. */
  activeUserCount: number;
}

/** The pending diff, sent as the preview's request body. */
export interface IRolePermissionChangeImpactPayload {
  slug: string;
  addPermissions: string[];
  removePermissions: string[];
  organizationId: string;
}
