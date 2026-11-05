import { ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import { Switch } from "@/components/ui-kits/switch/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { ACTIONS_I18N_MODULE } from "../constants/actions.constant";
import { ACTION_TARGETS, type ActionTarget, type IAction } from "../models/actions.model";
import { buildPayloadExample } from "../utils/action-groups";

interface ActionGroupTableProps {
  title: string;
  actions: IAction[];
  expanded: ReadonlySet<string>;
  busy: ReadonlySet<string>;
  onToggleExpanded: (name: string) => void;
  onTurnOn: (action: IAction, target: ActionTarget) => void;
  onTurnOff: (action: IAction, target: ActionTarget) => void;
}

export const switchKey = (name: string, target: ActionTarget) => `${name}:${target}`;

export function ActionGroupTable({
  title,
  actions,
  expanded,
  busy,
  onToggleExpanded,
  onTurnOn,
  onTurnOff,
}: Readonly<ActionGroupTableProps>) {
  const { t } = useT(ACTIONS_I18N_MODULE);
  const targetLabels: Record<ActionTarget, string> = {
    workflow: t("ACTIONS_PAGE.WORKFLOW"),
    function: t("ACTIONS_PAGE.FUNCTION"),
    webhook: t("ACTIONS_PAGE.WEBHOOK"),
  };

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h2 className="text-sm font-semibold text-high-emphasis">{title}</h2>
      <div className="overflow-hidden rounded-sm border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ACTIONS_PAGE.ACTION")}</TableHead>
              {ACTION_TARGETS.map((target) => (
                <TableHead key={target} className="w-28 text-center">
                  {targetLabels[target]}
                </TableHead>
              ))}
              <TableHead className="w-32 text-right">{t("ACTIONS_PAGE.PAYLOAD")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map((action) => {
              const isOpen = expanded.has(action.name);
              const panelId = `payload-${action.name}`;
              return (
                <ActionRows
                  key={action.name}
                  action={action}
                  isOpen={isOpen}
                  panelId={panelId}
                  busy={busy}
                  targetLabels={targetLabels}
                  onToggleExpanded={onToggleExpanded}
                  onTurnOn={onTurnOn}
                  onTurnOff={onTurnOff}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

interface ActionRowsProps {
  action: IAction;
  isOpen: boolean;
  panelId: string;
  busy: ReadonlySet<string>;
  targetLabels: Record<ActionTarget, string>;
  onToggleExpanded: (name: string) => void;
  onTurnOn: (action: IAction, target: ActionTarget) => void;
  onTurnOff: (action: IAction, target: ActionTarget) => void;
}

function ActionRows({
  action,
  isOpen,
  panelId,
  busy,
  targetLabels,
  onToggleExpanded,
  onTurnOn,
  onTurnOff,
}: Readonly<ActionRowsProps>) {
  const { t } = useT(ACTIONS_I18N_MODULE);
  const ToggleIcon = isOpen ? ChevronDown : ChevronRight;

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="text-sm font-medium text-high-emphasis">{action.label}</div>
          <code className="text-xs text-muted-foreground">{action.name}</code>
        </TableCell>
        {ACTION_TARGETS.map((target) => (
          <TableCell key={target} className="text-center">
            <Switch
              checked={action[target]}
              disabled={busy.has(switchKey(action.name, target))}
              aria-label={`${action.label} - ${targetLabels[target]}`}
              onCheckedChange={(on) => (on ? onTurnOn : onTurnOff)(action, target)}
            />
          </TableCell>
        ))}
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="xs"
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-label={`${action.label} - ${t("ACTIONS_PAGE.PAYLOAD")}`}
            onClick={() => onToggleExpanded(action.name)}
          >
            <ToggleIcon className="mr-1 h-4 w-4" />
            <span>{isOpen ? t("ACTIONS_PAGE.HIDE") : t("ACTIONS_PAGE.SHOW")}</span>
          </Button>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow id={panelId}>
          <TableCell colSpan={5} className="bg-muted/30">
            <p className="mb-2 text-xs text-muted-foreground">{t("ACTIONS_PAGE.PAYLOAD_HINT")}</p>
            <pre className="overflow-x-auto rounded-sm border border-border bg-background p-3 text-xs">
              <code>{buildPayloadExample(action)}</code>
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
