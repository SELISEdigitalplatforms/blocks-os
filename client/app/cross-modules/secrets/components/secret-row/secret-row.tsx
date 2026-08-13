import { useState } from "react";
import { format } from "date-fns";
import {
  ChevronRight,
  Copy,
  Eye,
  History,
  KeyRound,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  Unlock,
} from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui-kits/table/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  SECRET_STATUS,
  SECRET_STATUS_LABEL,
  SECRET_TYPE_LABEL,
  supportsValueReveal,
  type SecretResult,
  type SecretStatus,
} from "@/cross-modules/secrets/models/secret.model";
import { useRevealSecret } from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import { SecretDetail } from "../secret-detail/secret-detail";
import { RevealSecretModal } from "../reveal-secret-modal/reveal-secret-modal";
import { RotateSecretModal } from "../rotate-secret-modal/rotate-secret-modal";
import { SecretFormModal } from "../secret-form-modal/secret-form-modal";
import { SecretAuditModal } from "../secret-audit-modal/secret-audit-modal";
import {
  SecretActionDialog,
  type SecretLifecycleAction,
} from "../secret-action-dialog/secret-action-dialog";

const STATUS_VARIANT: Record<SecretStatus, "success" | "warning" | "secondary"> = {
  active: "success",
  locked: "warning",
  deleted: "secondary",
};

const NO_READ_PERMISSION = "You do not have permission to read this value";

const formatCreated = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd MMM yyyy");
};

/**
 * Wraps a control in a tooltip that still fires when the control is unavailable.
 *
 * A real `disabled` button swallows pointer events, so the explanation would never appear —
 * which is the whole point of disabling rather than hiding. `aria-disabled` plus a no-op
 * handler keeps the control reachable and announced while making the reason discoverable.
 */
const ExplainedButton = ({
  label,
  reason,
  unavailable,
  busy,
  onClick,
  children,
}: {
  label: string;
  reason?: string;
  /** Permanently refused for this row — carries `reason` as the explanation. */
  unavailable?: boolean;
  /** Momentarily inert while a request is in flight. Not a reason, so the label stays. */
  busy?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => {
  const explanation = unavailable && reason ? reason : label;
  const inert = unavailable || busy;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-7 w-7 p-0", inert && "cursor-not-allowed opacity-50")}
            aria-disabled={inert}
            aria-label={label}
            // Duplicated as a native title so the reason survives without a hover-capable
            // pointer, and so it is assertable without driving the tooltip open.
            title={explanation}
            onClick={() => {
              if (!inert) onClick();
            }}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
          {explanation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface SecretRowProps {
  secret: SecretResult;
}

/**
 * One secret in the list, with its expanded detail panel and its available actions.
 *
 * The action set is a function of type and status. Reveal and Copy are additionally gated on
 * `canReadValue`, which the backend evaluates per row — the access list, the lock state and
 * root override are all already folded into it, so nothing here re-derives the rule.
 */
export function SecretRow({ secret }: SecretRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<SecretLifecycleAction | null>(null);

  const { mutateAsync: readValue, isPending: isCopying } = useRevealSecret();

  const isDeleted = secret.status === SECRET_STATUS.Deleted;
  const isLocked = secret.status === SECRET_STATUS.Locked;
  // Reveal/Copy appear for API secrets only. Hiding them on service secrets is a UX choice, not
  // an enforced control: the backend lets any authenticated caller in the tenant read a service
  // value, so nothing here should imply otherwise.
  const showValueActions = supportsValueReveal(secret) && !isDeleted;
  const canRead = secret.canReadValue;

  /**
   * Copy goes through the same audited endpoint as Reveal — one click, one `GetValue` row. The
   * value is written to the clipboard and dropped; it is never held in state or in the cache.
   */
  const copyValue = async () => {
    try {
      const { value } = await readValue(secret.secretId);
      await navigator.clipboard.writeText(value);
      showSuccessToast({ description: "Secret value copied to the clipboard." });
    } catch (error) {
      showErrorToast({ errors: describeSecretError(error, "Could not copy the value.").message });
    }
  };

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpanded((v) => !v)}>
        <TableCell className="w-8 py-3.5 pl-4">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90",
            )}
          />
        </TableCell>

        <TableCell className="py-3.5">
          <div className="flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate font-medium text-high-emphasis">{secret.name}</p>
              {secret.description && (
                <p className="truncate text-xs text-muted-foreground">{secret.description}</p>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="py-3.5">
          <Badge variant="outline" className="font-normal">
            {SECRET_TYPE_LABEL[secret.type]}
          </Badge>
        </TableCell>

        <TableCell className="py-3.5">
          <Badge variant={STATUS_VARIANT[secret.status]} className="font-normal">
            {SECRET_STATUS_LABEL[secret.status]}
          </Badge>
        </TableCell>

        <TableCell className="py-3.5 text-sm text-muted-foreground">
          {formatCreated(secret.createdDate)}
        </TableCell>

        <TableCell className="py-3.5 pr-4 text-right" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-end gap-0.5">
            {showValueActions && !isLocked && (
              <>
                <ExplainedButton
                  label="Reveal value"
                  reason={NO_READ_PERMISSION}
                  unavailable={!canRead}
                  onClick={() => setRevealOpen(true)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </ExplainedButton>
                <ExplainedButton
                  label="Copy value"
                  reason={NO_READ_PERMISSION}
                  unavailable={!canRead}
                  busy={isCopying}
                  onClick={copyValue}
                >
                  <Copy className="h-3.5 w-3.5" />
                </ExplainedButton>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label={`Actions for ${secret.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isDeleted ? (
                  // A deleted secret cannot be edited, rotated or locked — only brought back.
                  <DropdownMenuItem onClick={() => setLifecycleAction("restore")}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRotateOpen(true)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rotate
                    </DropdownMenuItem>
                    {isLocked ? (
                      <DropdownMenuItem onClick={() => setLifecycleAction("unlock")}>
                        <Unlock className="mr-2 h-4 w-4" />
                        Unlock
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setLifecycleAction("lock")}>
                        <Lock className="mr-2 h-4 w-4" />
                        Lock
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setLifecycleAction("delete")}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAuditOpen(true)}>
                  <History className="mr-2 h-4 w-4" />
                  Audit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="p-0">
            <SecretDetail secret={secret} />
          </TableCell>
        </TableRow>
      )}

      {revealOpen && (
        <RevealSecretModal open={revealOpen} onOpenChange={setRevealOpen} secret={secret} />
      )}
      {editOpen && (
        <SecretFormModal open={editOpen} onOpenChange={setEditOpen} secret={secret} />
      )}
      {rotateOpen && (
        <RotateSecretModal open={rotateOpen} onOpenChange={setRotateOpen} secret={secret} />
      )}
      {auditOpen && (
        <SecretAuditModal open={auditOpen} onOpenChange={setAuditOpen} secret={secret} />
      )}
      {lifecycleAction && (
        <SecretActionDialog
          open
          onOpenChange={(open) => !open && setLifecycleAction(null)}
          secret={secret}
          action={lifecycleAction}
        />
      )}
    </>
  );
}
