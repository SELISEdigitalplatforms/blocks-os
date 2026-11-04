import { useMemo, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog/confirm-dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { ActionGroupTable, switchKey } from "../../components/action-group-table";
import { ACTION_ERROR_CODES, ACTIONS_I18N_MODULE } from "../../constants/actions.constant";
import { useGetActions, useUpdateAction } from "../../hooks/use-actions";
import type { ActionTarget, IAction } from "../../models/actions.model";
import { groupActions } from "../../utils/action-groups";

interface PendingOff {
  action: IAction;
  target: ActionTarget;
}

const toggled = (set: ReadonlySet<string>, key: string): Set<string> => {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
};

export function ActionsPage() {
  const { t } = useT(ACTIONS_I18N_MODULE);
  const { data, isLoading, isError, refetch } = useGetActions();
  const { mutateAsync: updateAction } = useUpdateAction();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [pendingOff, setPendingOff] = useState<PendingOff | null>(null);

  const groups = useMemo(() => groupActions(data ?? []), [data]);

  const groupTitle = (id: string) => {
    if (id === "iam.user") return t("ACTIONS_PAGE.GROUP_USERS");
    if (id === "iam.organization") return t("ACTIONS_PAGE.GROUP_ORGANIZATIONS");
    return id;
  };

  const errorMessages = {
    [ACTION_ERROR_CODES.NotFound]: t("ACTIONS_PAGE.ERROR_ACTION_NOT_FOUND"),
    [ACTION_ERROR_CODES.NotSeeded]: t("ACTIONS_PAGE.ERROR_ACTIONS_NOT_SEEDED"),
    [ACTION_ERROR_CODES.InvalidTarget]: t("ACTIONS_PAGE.ERROR_INVALID_TARGET"),
  };

  const targetLabel = (target: ActionTarget) =>
    ({
      workflow: t("ACTIONS_PAGE.WORKFLOW"),
      function: t("ACTIONS_PAGE.FUNCTION"),
      webhook: t("ACTIONS_PAGE.WEBHOOK"),
    })[target];

  const apply = async (action: IAction, target: ActionTarget, enabled: boolean) => {
    const key = switchKey(action.name, target);
    setBusy((current) => new Set(current).add(key));
    try {
      await updateAction({ name: action.name, target, enabled });
      showSuccessToast({
        description: t(enabled ? "ACTIONS_PAGE.TURNED_ON" : "ACTIONS_PAGE.TURNED_OFF", {
          action: action.label,
          target: targetLabel(target),
        }),
      });
    } catch (error) {
      showErrorToast({
        title: t("ACTIONS_PAGE.COULD_NOT_CHANGE"),
        errors: isErrorWithErrors(error) ? error.errors : t("ACTIONS_PAGE.ERROR_UNEXPECTED"),
        customMessages: errorMessages,
      });
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const requestOff = (action: IAction, target: ActionTarget) => setPendingOff({ action, target });
  const turnOn = (action: IAction, target: ActionTarget) => apply(action, target, true);

  const confirmOff = () => {
    if (!pendingOff) return;
    const { action, target } = pendingOff;
    setPendingOff(null);
    apply(action, target, false);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Zap}
        title={t("ACTIONS_PAGE.LOAD_FAILED_TITLE")}
        description={t("ACTIONS_PAGE.LOAD_FAILED_DESCRIPTION")}
        action={<Button onClick={() => refetch()}>{t("common:RETRY")}</Button>}
      />
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Zap}
        title={t("ACTIONS_PAGE.EMPTY_TITLE")}
        description={t("ACTIONS_PAGE.EMPTY_DESCRIPTION")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t("ACTIONS_PAGE.INTRO")}</p>
      {groups.map((group) => (
        <ActionGroupTable
          key={group.id}
          title={groupTitle(group.id)}
          actions={group.actions}
          expanded={expanded}
          busy={busy}
          onToggleExpanded={(name) => setExpanded((current) => toggled(current, name))}
          onTurnOn={turnOn}
          onTurnOff={requestOff}
        />
      ))}
      <ConfirmDialog
        open={pendingOff !== null}
        onOpenChange={(open) => !open && setPendingOff(null)}
        title={t("ACTIONS_PAGE.CONFIRM_OFF_TITLE")}
        description={t("ACTIONS_PAGE.CONFIRM_OFF_DESCRIPTION", {
          action: pendingOff?.action.label ?? "",
          target: pendingOff ? targetLabel(pendingOff.target) : "",
        })}
        confirmLabel={t("ACTIONS_PAGE.TURN_OFF")}
        cancelLabel={t("common:CANCEL")}
        onConfirm={confirmOff}
        destructive
      />
    </div>
  );
}
