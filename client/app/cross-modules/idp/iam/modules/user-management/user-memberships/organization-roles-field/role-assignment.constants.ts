import { tStatic } from "@seliseblocks/genesis-os";

export const getMinimumRoleMessage = () =>
  tStatic("os.idp.users", "ROLE_ASSIGNMENT_CONSTANTS.MINIMUM_ROLE_MESSAGE");
