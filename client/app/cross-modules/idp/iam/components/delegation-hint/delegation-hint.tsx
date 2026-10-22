import { useDelegationScope } from "@blocks-idp/iam/hooks/use-delegation-scope";
import {
  ASSIGNABLE_ROLES_HELPER,
  GRANT_PERMISSION_TOOLTIP,
} from "@blocks-idp/iam/utils/delegation-scope";

type DelegationHintProps = { kind: "roles" | "permissions" };

/** One-line helper under a role or permission picker; shown only to a limited caller. */
export const DelegationHint = ({ kind }: Readonly<DelegationHintProps>) => {
  const { isRestricted } = useDelegationScope();
  if (!isRestricted) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid={`delegation-hint-${kind}`}>
      {kind === "roles" ? ASSIGNABLE_ROLES_HELPER : GRANT_PERMISSION_TOOLTIP}
    </p>
  );
};
