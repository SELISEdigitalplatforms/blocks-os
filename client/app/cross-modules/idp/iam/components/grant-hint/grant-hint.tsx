import { useGrantScope } from "@blocks-idp/iam/hooks/use-grant-scope";
import {
  ASSIGNABLE_ROLES_HELPER,
  DIRECT_PERMISSIONS_HELPER,
} from "@blocks-idp/iam/utils/grant-scope";

type GrantHintProps = { kind: "roles" | "permissions" };

/** One-line helper under a role or permission picker; shown only to a descendant. */
export const GrantHint = ({ kind }: Readonly<GrantHintProps>) => {
  const { isDescendant } = useGrantScope();
  if (!isDescendant) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid={`grant-hint-${kind}`}>
      {kind === "roles" ? ASSIGNABLE_ROLES_HELPER : DIRECT_PERMISSIONS_HELPER}
    </p>
  );
};
