import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Input } from "@/components/ui-kits/input/input";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { LOGICAL_OPERATOR } from "@blocks-idp/data-access/gateway/constants/schema-access-control";
import { useDeletePolicy } from "@blocks-idp/data-access/gateway/hooks/use-configuration";
import type { IPolicyItem } from "@blocks-idp/data-access/gateway/models/data-service";
import { ruleSetLines } from "@blocks-idp/data-access/gateway/utils/access-phrase";
import {
  countPolicyGroups,
  countPolicyRules,
} from "@blocks-idp/data-access/gateway/utils/schema-access-control.utils";
import {
  AlertTriangle,
  ChevronDown,
  Info,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

/** How far each level of a nested group steps in, in the expanded rule-set list. */
const RULE_GROUP_INDENT_PX = 18;

interface SchemaAccessControlAccordionProps {
  policies?: IPolicyItem[];
  onAddRuleSet?: () => void;
  onEditPolicy?: (policy: IPolicyItem) => void;
  /**
   * Fires after a delete actually succeeds. `useDeletePolicy`'s own cache
   * invalidation can't target just this entity's policy list (a delete only
   * carries `itemId`, not the schema/field it belonged to), so the list this
   * accordion renders is whatever `policies` its parent passed in — it has
   * to be told to refetch, the same way a create or update already is.
   */
  onDeleteSuccess?: () => void;
  /** Reported through the host's own status snackbar instead of a toast —
   *  same treatment a rule-set save/update result already gets, so a delete
   *  doesn't show up in a different place than every other result on this
   *  panel. See `useTransientStatus`. */
  onDeleteError?: (errors: unknown) => void;
  isEditing?: boolean;
}

export const SchemaAccessControlAccordion = ({
  policies = [],
  onAddRuleSet,
  onEditPolicy,
  onDeleteSuccess,
  onDeleteError,
  isEditing,
}: SchemaAccessControlAccordionProps) => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [deletingPolicy, setDeletingPolicy] = useState<IPolicyItem | null>(
    null,
  );
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: deletePolicy, isPending: isDeleting } =
    useDeletePolicy();

  const handleDeletePolicy = async () => {
    if (!deletingPolicy?.itemId) return;
    try {
      const res = await deletePolicy({
        itemId: deletingPolicy.itemId,
        projectKey,
      });
      if (res?.isSuccess) {
        onDeleteSuccess?.();
      } else {
        onDeleteError?.(res?.errors);
      }
    } catch (error) {
      onDeleteError?.(error);
    }
    setDeletingPolicy(null);
  };

  const filteredPolicies = searchText
    ? policies.filter((p) =>
        p.policyName.toLowerCase().includes(searchText.toLowerCase()),
      )
    : policies;

  /**
   * Custom grants only what its rule sets allow, so removing the last one
   * leaves the schema on Custom with nothing in it — denying everyone.
   *
   * The tier footer refuses to *save* into that state, but a delete arrives
   * from the other side: the tier is already saved as Custom, so the schema
   * silently became a lockout with nothing having looked wrong at the time.
   * The delete is still allowed — clearing the rules out on the way to
   * another tier is legitimate — but it says what it will do first.
   *
   * Counted against `policies`, not `filteredPolicies`: a search that hides
   * the others does not make this the last one.
   */
  const isLastRuleSet = policies.length === 1;

  return (
    <div className="space-y-2">
      {!isEditing && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/70">
            Rule sets
          </span>
          <span className="rounded-full bg-access-custom-bg px-1.5 py-0.5 text-[10px] font-bold text-access-custom-fg">
            {policies.length}
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
            onClick={onAddRuleSet}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add rule set</span>
          </Button>
        </div>
      )}

      {!isEditing && policies.length > 0 && (
        <Input
          placeholder="Search rule sets"
          aria-label="Search rule sets"
          className="h-9 text-xs"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      )}

      {!isEditing && policies.length > 0 && (
        <div className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5">
          <Info className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-[11px] leading-relaxed text-muted-foreground">
            Access is granted when <strong className="font-semibold text-foreground">any</strong> rule
            set matches.
          </span>
        </div>
      )}

      {filteredPolicies.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {filteredPolicies.map((policy, index) => {
            const isOpen = openId === index;
            const rulesCount = countPolicyRules(policy.ruleGroup);
            const groupsCount = countPolicyGroups(policy.ruleGroup);
            const matchesAll = policy.ruleGroup.logicalOperator === LOGICAL_OPERATOR.AND;
            const logicalLabel = matchesAll
              ? "every rule must match"
              : "any rule may match";
            const rulesLabel = rulesCount === 1 ? "1 rule" : `${rulesCount} rules`;
            // Only mentioned once a set has groups, so a flat set reads as it always has.
            const groupsLabel =
              groupsCount === 0 ? "" : ` · ${groupsCount} ${groupsCount === 1 ? "group" : "groups"}`;
            const matchModeLabel = matchesAll ? "match all" : "match any";

            return (
              <li
                key={policy.itemId ?? index}
                className="overflow-hidden rounded-md border border-border/50"
              >
                <div className="flex items-center gap-1 pr-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                        isOpen ? "rotate-0" : "-rotate-90",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {policy.policyName}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {rulesLabel}
                      {groupsLabel} · {matchModeLabel}
                    </span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${policy.policyName}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => onEditPolicy?.(policy)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Edit</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setDeletingPolicy(policy)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {isOpen && (
                  <div className="border-t border-border/40 bg-muted/20 px-2.5 py-2">
                    {/* Read as a sentence: "when X, and Y" — the joiner is the
                        set's own operator, so the relation is never guessed. */}
                    <p className="text-[11px] text-muted-foreground">
                      Grants access when {logicalLabel}:
                    </p>
                    <ul className="mt-1.5 flex flex-col">
                      {ruleSetLines(policy).map((line, ruleIdx) => (
                        <li
                          key={ruleIdx}
                          className="relative flex gap-1.5 py-0.5 text-xs leading-relaxed"
                          style={{ paddingLeft: line.depth * RULE_GROUP_INDENT_PX }}
                        >
                          {/* One guide per group this line sits inside, so a group
                              reads as a block even where its lines run on. */}
                          {Array.from({ length: line.depth }, (_, level) => (
                            <span
                              key={level}
                              aria-hidden
                              className="absolute bottom-0 top-0 w-px bg-border"
                              style={{ left: level * RULE_GROUP_INDENT_PX + 4 }}
                            />
                          ))}
                          <span className="shrink-0 font-medium text-muted-foreground">
                            {line.lead}
                          </span>
                          <span
                            className={cn(
                              "min-w-0",
                              line.kind === "group" ? "text-muted-foreground" : "text-foreground",
                            )}
                          >
                            {line.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filteredPolicies.length === 0 && !isEditing && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {searchText
            ? `No rule sets match "${searchText}"`
            : "No rule sets added yet. Click Add rule set to create one."}
        </p>
      )}

      <Dialog
        open={!!deletingPolicy}
        onOpenChange={(open) => {
          if (!open) setDeletingPolicy(null);
        }}
      >
        <ConfirmationModal
          onCancel={() => setDeletingPolicy(null)}
          onConfirm={handleDeletePolicy}
          data={{
            dialogTitle: isLastRuleSet ? "Delete the only rule set?" : "Delete rule set?",
            dialogSubtitle: (
              <>
                <span className="block">
                  Are you sure you want to delete {deletingPolicy?.policyName}? This
                  action cannot be undone.
                </span>
                {isLastRuleSet && (
                  <span className="mt-3 flex items-start gap-2.5 rounded-md border border-warning-500/50 bg-warning-100 px-3 py-2.5 text-warning-800">
                    <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">
                        This leaves access with nobody
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed opacity-90">
                        Custom access grants only what its rule sets allow, and this is
                        the last one. Choose a different access level if you meant to
                        open it up instead.
                      </span>
                    </span>
                  </span>
                )}
              </>
            ),
            confirmButton: "Delete",
            cancelButton: "Cancel",
          }}
          buttonState={{ confirm: { disable: isDeleting } }}
        />
      </Dialog>
    </div>
  );
};

