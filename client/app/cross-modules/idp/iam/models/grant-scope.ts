/**
 * What the signed-in user may administer in the token's organization (access grant).
 * The server computes it from the database; the client only uses it to hide or disable choices
 * the server would refuse anyway.
 */
export interface IGrantScope {
  /** The system user (org "default") is never limited. */
  isSystemUser: boolean;
  /**
   * A top user: its power to manage comes from a standalone role. It manages every role its
   * organization created and every member. Optional: an older IAM does not send it.
   */
  isTopUser?: boolean;
  heldRoles: string[];
  /** The held roles that give the power to manage; a descendant hangs new roles under these. */
  powerRoles?: string[];
  managedRoles: string[];
  assignableRoles: string[];
  heldPermissions: string[];
  /** What a descendant may put on a role below it: its own roles' permissions and direct ones. */
  ownPermissions?: string[];
}
