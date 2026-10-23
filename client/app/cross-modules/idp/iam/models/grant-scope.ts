/**
 * What the signed-in user may grant in the token's organization (access grant).
 * The server computes it from the database; the client only uses it to hide or disable choices
 * the server would refuse anyway.
 */
export interface IGrantScope {
  /** The system user is never limited: the UI stays as it was before access grant existed. */
  isSystemUser: boolean;
  heldRoles: string[];
  managedRoles: string[];
  assignableRoles: string[];
  heldPermissions: string[];
}
