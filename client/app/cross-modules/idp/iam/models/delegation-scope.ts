/**
 * What the signed-in user may grant in the token's organization ("Delegated administration").
 * The server computes it from the database; the client only uses it to hide or disable choices
 * the server would refuse anyway.
 */
export interface IDelegationScope {
  /** The system user is never limited: the UI stays as it was before delegation existed. */
  isSystemUser: boolean;
  /** `Audit` only logs a refusal, so the UI does not limit anything; `Enforce` refuses. */
  mode: "Audit" | "Enforce";
  heldRoles: string[];
  managedRoles: string[];
  assignableRoles: string[];
  heldPermissions: string[];
}
