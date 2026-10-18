"use client";
import { forwardRef, useEffect, useId, useImperativeHandle, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  ACCESS_LEVEL_TO_TYPE,
  ACCESS_TYPE_TO_LEVEL,
  ACCESS_TYPES,
  POLICY_TYPE,
  TAB_TO_OPERATION,
} from "@blocks-idp/data-access/gateway/constants/schema-access-control";
import { Loader } from "lucide-react";
import { SchemaAccessControlViewProps } from "@blocks-idp/data-access/gateway/models/schema-preview.types";
import type {
  ICreatePolicyPayload,
  IPolicyItem,
  IUpdatePolicyPayload,
} from "@blocks-idp/data-access/gateway/models/data-service";
import { cn } from "@/lib/utils";
import { RuleSetForm } from "./rule-set-form";
import { SchemaAccessControlAccordion } from "./schema-access-control-accordion";
import {
  useCreatePolicy,
  useGetPolicyData,
  useSetRowColumnPermission,
  useUpdatePolicy,
} from "@blocks-idp/data-access/gateway/hooks/use-configuration";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { accessEffect, verbPhrase } from "@blocks-idp/data-access/gateway/utils/access-phrase";
import {
  accessPresets,
  type AccessPreset,
  type PresetRuleSet,
} from "@blocks-idp/data-access/gateway/utils/access-presets";
import {
  TIER_CONTAINER_CLASS,
  TIER_VALUE_CLASS,
  TIER_ICON,
  StatusSnackbar,
  tierFromType,
} from "../primitives";
import { useNarrowContainer } from "@blocks-idp/data-access/gateway/hooks/use-narrow-container";
import { useTransientStatus } from "@blocks-idp/data-access/gateway/hooks/use-transient-status";
import { AccessEffectLine } from "./access-effect-line";
import { AccessPresetList } from "./access-preset-list";

/** What the rule editor's own Save/Update hands back to be sent to the API. */
interface RuleSetSubmission {
  payload: ICreatePolicyPayload | IUpdatePolicyPayload;
  isEditMode: boolean;
}

/** Imperative surface for a host (the inspector panel, the schema details
 *  page) that needs to know about — and act on — unsaved changes it can't
 *  see into, e.g. before closing the panel or switching to a different
 *  field's access. */
export interface SchemaAccessControlViewHandle {
  isDirty: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}

/** "Who is allowed" tile grid — Inherited is column-only (there is nothing to inherit from at row level). */
const ACCESS_TIER_TILES = [
  { type: ACCESS_TYPES.INHERITED, label: "Inherited" },
  { type: ACCESS_TYPES.PUBLIC, label: "Public" },
  { type: ACCESS_TYPES.LOGGED_IN, label: "Signed-in users" },
  { type: ACCESS_TYPES.CUSTOM, label: "Custom" },
];

/** Below this width the 4-tile grid can no longer fit a label beside every icon. */
const NARROW_TILES_WIDTH = 420;

/** Whether a policy belongs to the row/column scope this panel is showing. */
const policyMatchesScope = (
  policy: IPolicyItem,
  operation: number,
  isRowLevel: boolean,
  fieldNames: string[],
): boolean => {
  if (policy.operation !== operation) return false;
  if (isRowLevel) {
    return !policy.fieldNames || policy.fieldNames.length === 0;
  }
  return policy.fieldNames?.some((f) => fieldNames.includes(f)) ?? false;
};

interface AccessTierTilesProps {
  level: SchemaAccessControlViewProps["level"];
  isRowLevel: boolean;
  selectedType: string;
  disabled: boolean;
  onPick: (value: string) => void;
}

/** The "Who is allowed" tile grid: one native radio per tier, styled as a tile. */
const AccessTierTiles = ({
  level,
  isRowLevel,
  selectedType,
  disabled,
  onPick,
}: Readonly<AccessTierTilesProps>) => {
  const groupName = useId();
  const { ref: tilesRef, isNarrow: tilesNarrow } = useNarrowContainer<HTMLDivElement>(
    NARROW_TILES_WIDTH,
  );
  // Field tiles sit two to a row, wide enough to always carry their label;
  // only the schema-level tiles ever collapse to icons in a narrow panel.
  const iconOnlyTiles = isRowLevel && tilesNarrow;
  const visibleTiers =
    level === "column"
      ? ACCESS_TIER_TILES
      : ACCESS_TIER_TILES.filter((t) => t.type !== ACCESS_TYPES.INHERITED);

  return (
    <div
      ref={tilesRef}
      className={cn(
        "grid gap-2",
        isRowLevel ? "grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3" : "grid-cols-2",
      )}
      role="radiogroup"
      aria-label="Who is allowed"
    >
      {visibleTiers.map(({ type, label }) => {
        const tier = tierFromType(type);
        const isSelected = type === selectedType;
        const Icon = TIER_ICON[tier];
        return (
          <label
            key={type}
            title={label}
            className={cn(
              "flex h-11 min-w-0 items-center gap-2 rounded-md border px-3 text-left text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              iconOnlyTiles && "justify-center",
              isSelected
                ? cn(TIER_CONTAINER_CLASS[tier], TIER_VALUE_CLASS[tier])
                : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={groupName}
              className="sr-only"
              aria-label={label}
              checked={isSelected}
              disabled={disabled}
              onChange={() => onPick(type)}
            />
            <span
              className={cn(
                "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
                isSelected ? TIER_CONTAINER_CLASS[tier] : "border-border/60",
              )}
            >
              <Icon
                className={cn("h-3 w-3", isSelected ? TIER_VALUE_CLASS[tier] : "opacity-70")}
                aria-hidden
              />
            </span>
            {!iconOnlyTiles && <span className="min-w-0 flex-1 truncate">{label}</span>}
          </label>
        );
      })}
    </div>
  );
};

/**
 * Asked before saving Custom with no rule sets. On platform schemas that refuses
 * every signed-in user of the project, and the platform's own services acting for
 * them, so e.g. a Custom View on Role or User with nothing in it breaks sign-in.
 */
const EmptyCustomConfirmDialog = ({
  verb,
  subject,
  onAnswer,
}: Readonly<{ verb: string; subject: string; onAnswer: (confirmed: boolean) => void }>) => (
  <Dialog open onOpenChange={(open) => !open && onAnswer(false)}>
    <DialogContent className="mr-4 w-full max-w-[440px] rounded-md">
      <DialogHeader>
        <DialogTitle className="text-left text-lg font-semibold leading-7">Nobody will be able to {verb} {subject}</DialogTitle>
        <DialogDescription className="mt-2 wrap-break-word text-left text-sm font-normal leading-5">
          Custom with no rule sets allows nobody. Every signed-in user of this project, and the platform services
          acting for them, will be refused until you add a rule set. Features that depend on {subject} can stop working.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onAnswer(false)}>
          Cancel
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => onAnswer(true)}>
          Save anyway
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/** A yes/no question asked from async code: `ask()` resolves with whatever is passed to `answer`. */
function useAsyncConfirm() {
  const [resolver, setResolver] = useState<((confirmed: boolean) => void) | null>(null);
  const ask = () => new Promise<boolean>((resolve) => setResolver(() => resolve));
  const answer = (confirmed: boolean) => {
    resolver?.(confirmed);
    setResolver(null);
  };
  return { isAsking: resolver !== null, ask, answer };
}

interface PolicyListPaneProps {
  isLoading: boolean;
  policies: IPolicyItem[];
  schemaFields: SchemaAccessControlViewProps["schemaFields"];
  onApplyPreset: (preset: AccessPreset) => void;
  onAddRuleSet: () => void;
  onEditPolicy: (policy: IPolicyItem) => void;
  onDeleteSuccess: () => void;
  onDeleteError: (errors: unknown) => void;
}

/** The Custom tier's body: loading state, the sample presets, or the saved rule sets. */
const PolicyListPane = ({
  isLoading,
  policies,
  schemaFields,
  onApplyPreset,
  onAddRuleSet,
  onEditPolicy,
  onDeleteSuccess,
  onDeleteError,
}: Readonly<PolicyListPaneProps>) => {
  if (isLoading) {
    return (
      <output
        className="flex min-h-[200px] flex-col items-center justify-center gap-2 py-12"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-sm text-muted-foreground">Loading access rules…</span>
      </output>
    );
  }
  if (policies.length === 0) {
    return (
      <AccessPresetList
        presets={accessPresets(schemaFields)}
        onApply={onApplyPreset}
        onStartBlank={onAddRuleSet}
      />
    );
  }
  return (
    <SchemaAccessControlAccordion
      policies={policies}
      onAddRuleSet={onAddRuleSet}
      onEditPolicy={onEditPolicy}
      onDeleteSuccess={onDeleteSuccess}
      onDeleteError={onDeleteError}
    />
  );
};

export const SchemaAccessControlView = forwardRef<
  SchemaAccessControlViewHandle,
  SchemaAccessControlViewProps
>(function SchemaAccessControlView(
  {
    schemaFields,
    schemaName,
    schemaId,
    level,
    operation,
    fieldNames,
    defaultAccessLevel,
    onRuleEditorOpenChange,
  },
  ref,
) {
  const [showRuleSetForm, setShowRuleSetForm] = useState(false);

  // The inspector widens for the rule editor; it needs to
  // be told, because the editor opens from inside here.
  useEffect(() => {
    onRuleEditorOpenChange?.(showRuleSetForm);
  }, [showRuleSetForm, onRuleEditorOpenChange]);
  const [editingPolicy, setEditingPolicy] = useState<IPolicyItem | undefined>(undefined);
  // The tile the user currently has picked — drives the rest of the panel
  // (effect line, rule-set list) immediately, same as the design's "live"
  // preview. It only reaches the server once Save is pressed.
  const [selectedAccessType, setSelectedAccessType] = useState("");
  // The last value actually confirmed by the API, i.e. what Cancel reverts to
  // and what `selectedAccessType` is compared against to decide "dirty".
  const [lastSavedAccessType, setLastSavedAccessType] = useState("");
  const [initialized, setInitialized] = useState(false);
  /** Preset values handed to the form, and the set still to come after it saves. */
  const [seedRuleSet, setSeedRuleSet] = useState<PresetRuleSet | undefined>();
  const [queuedRuleSet, setQueuedRuleSet] = useState<PresetRuleSet | undefined>();
  const [isSavingRuleSet, setIsSavingRuleSet] = useState(false);
  const emptyCustomConfirm = useAsyncConfirm();
  // Reported inline, in the footer's own status slot, instead of a toast —
  // the shared toast viewport docks bottom-right, right where this panel's
  // own Save button sits.
  const { status, setSuccess, setError } = useTransientStatus();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync: createPolicy } = useCreatePolicy();
  const { mutateAsync: updatePolicy } = useUpdatePolicy();

  // Fetch when access is custom, including first paint (selectedAccessType is still "" until useEffect).
  // Also fetch when defaultAccessLevel is unknown and we haven't yet determined the type.
  const defaultResolvedType =
    defaultAccessLevel === undefined ? undefined : ACCESS_LEVEL_TO_TYPE[defaultAccessLevel];
  const defaultLevelUnmapped =
    defaultAccessLevel !== undefined && defaultResolvedType === undefined;
  const isPolicyFetchEnabled =
    selectedAccessType === ACCESS_TYPES.CUSTOM ||
    defaultResolvedType === ACCESS_TYPES.CUSTOM ||
    (defaultAccessLevel === undefined && !initialized) ||
    (defaultLevelUnmapped && !initialized);

  const {
    data: policyResponse,
    refetch,
    isPending,
    isFetching,
  } = useGetPolicyData({
    entityName: schemaName,
    projectKey,
    schemaId,
    enabled: isPolicyFetchEnabled,
  });

  const isPolicyListLoading =
    isPolicyFetchEnabled && (isPending || (isFetching && policyResponse === undefined));
  const { mutateAsync: setRowColumnPermission, isPending: isUpdating } =
    useSetRowColumnPermission(schemaId);

  const allPolicies = policyResponse?.isSuccess ? policyResponse.data : [];
  const isRowLevel = fieldNames.length === 0;
  const policies = allPolicies.filter((p) =>
    policyMatchesScope(p, operation, isRowLevel, fieldNames),
  );

  // Server / parent field access level is source of truth whenever it is known (refetch after save).
  useEffect(() => {
    if (defaultAccessLevel === undefined) return;
    const resolved = ACCESS_LEVEL_TO_TYPE[defaultAccessLevel];
    if (!resolved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds local state from the server value once it is known
    setSelectedAccessType(resolved);
    setLastSavedAccessType(resolved);
    setInitialized(true);
    if (resolved !== ACCESS_TYPES.CUSTOM) {
      setShowRuleSetForm(false);
      setEditingPolicy(undefined);
    }
  }, [defaultAccessLevel]);

  // Infer from policies only when the API does not expose a field-level enum (legacy / bulk edge cases).
  useEffect(() => {
    const hasKnownDefault =
      defaultAccessLevel !== undefined && !!ACCESS_LEVEL_TO_TYPE[defaultAccessLevel];

    if (hasKnownDefault) return;
    if (initialized) return;
    if (!policyResponse) return;

    const inferred = policies.length > 0 ? ACCESS_TYPES.CUSTOM : ACCESS_TYPES.LOGGED_IN;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds local state from the server value once it is known
    setSelectedAccessType(inferred);
    setLastSavedAccessType(inferred);
    setInitialized(true);
  }, [defaultAccessLevel, policyResponse, policies.length, initialized]);

  const currentAccessType = selectedAccessType || ACCESS_TYPES.LOGGED_IN;
  const isAccessTypeDirty = initialized && selectedAccessType !== lastSavedAccessType;

  /** Moves on to the queued second rule set of a two-set preset, or closes
   *  the form when there's nothing left to seed. */
  const advanceAfterRuleSetSaved = () => {
    setEditingPolicy(undefined);

    // "Owner, plus a support override" is two rule sets, and the form holds
    // one. The second is seeded as soon as the first is saved.
    if (queuedRuleSet) {
      setSeedRuleSet(queuedRuleSet);
      setQueuedRuleSet(undefined);
      return;
    }

    setSeedRuleSet(undefined);
    setShowRuleSetForm(false);
  };

  /**
   * What the rule editor's own Save/Update hands back — sent to the API
   * immediately, no staging: first the pending tier change, if Custom was
   * just picked and hasn't reached the server yet (rules belong to a Custom
   * policy, so this always has to land before the rule that depends on it),
   * then the rule set itself.
   */
  const handleRuleSetSubmit = async (submission: RuleSetSubmission) => {
    setIsSavingRuleSet(true);
    try {
      if (isAccessTypeDirty) {
        const tierSaved = await handleSaveAccessType();
        if (!tierSaved) return; // leave the form open so the user can retry
      }

      const res = submission.isEditMode
        ? await updatePolicy(submission.payload as IUpdatePolicyPayload)
        : await createPolicy(submission.payload as ICreatePolicyPayload);

      if (!res?.isSuccess) {
        setError(res?.errors);
        return; // leave the form open with its values so the user can retry
      }

      setSuccess("Rule set saved successfully");
      refetch();
      advanceAfterRuleSetSaved();
    } catch (error) {
      setError(error);
    } finally {
      setIsSavingRuleSet(false);
    }
  };

  const applyPreset = (preset: AccessPreset) => {
    const [first, ...rest] = preset.ruleSets;
    setEditingPolicy(undefined);
    setSeedRuleSet(first);
    setQueuedRuleSet(rest[0]);
    setShowRuleSetForm(true);
  };

  // Picking a tile is local only — it drives the effect line and rule-set
  // list immediately (so Custom can be set up before it's saved), but nothing
  // reaches the API until Save.
  const handleTierPick = (value: string) => {
    setSelectedAccessType(value);
  };

  /**
   * Persists the selected tier. Returns whether the caller may carry on — the
   * rule editor chains its own save onto this one, and must not send rules
   * for a policy whose level failed to save.
   */
  const handleSaveAccessType = async (): Promise<boolean> => {
    const newLevel = ACCESS_TYPE_TO_LEVEL[selectedAccessType];
    if (newLevel === undefined) return true;

    try {
      const res = await setRowColumnPermission({
        projectKey,
        schemaId,
        operation,
        policyType: level === "row" ? POLICY_TYPE.ROW : POLICY_TYPE.COLUMN,
        fieldNames: level === "column" ? fieldNames : [],
        accessLevel: newLevel,
      });

      if (res?.isSuccess) {
        setSuccess("Access level updated successfully");
        setLastSavedAccessType(selectedAccessType);
        return true;
      }

      setError(res?.errors);
      return false;
    } catch (error) {
      setError(error);
      return false;
    }
  };

  // Rule sets never sit unsaved — a picked tier is the only thing this panel
  // can be dirty about, since the rule editor's own Save/Update always sends
  // straight to the API (see `handleRuleSetSubmit`).
  const hasUnsavedChanges = isAccessTypeDirty;

  /** Only reached from the panel's own footer (i.e. the rule editor is
   *  closed) and from the unsaved-changes guard when leaving with a tier
   *  picked but not yet saved — there is never a rule set left to send from
   *  here. */
  const handleFinalSave = async (): Promise<boolean> => {
    if (!isAccessTypeDirty) return true;
    if (selectedAccessType === ACCESS_TYPES.CUSTOM && policies.length === 0 && !(await emptyCustomConfirm.ask())) {
      return false;
    }
    return handleSaveAccessType();
  };

  const handleCancelAccessType = () => {
    setSelectedAccessType(lastSavedAccessType);
  };

  useImperativeHandle(
    ref,
    () => ({
      isDirty: hasUnsavedChanges,
      save: handleFinalSave,
      discard: () => {
        setSelectedAccessType(lastSavedAccessType);
        setShowRuleSetForm(false);
        setEditingPolicy(undefined);
      },
    }),
    // Deliberately not memoized against a narrower dep list: this handle is
    // only ever read at click-time (before a close/switch), not during
    // render, so a fresh closure every render costs nothing but guarantees
    // `save`/`discard` never act on stale tier state.
  );

  // The view is handed a numeric operation; the phrasing is keyed by tab id.
  const tabForOperation =
    Object.keys(TAB_TO_OPERATION).find((tab) => TAB_TO_OPERATION[tab] === operation) ?? "view";
  const effectSubject = isRowLevel ? schemaName : `${schemaName}.${fieldNames.join(", ")}`;

  const effect = accessEffect({
    tier: tierFromType(currentAccessType),
    tab: tabForOperation,
    subject: effectSubject,
    policies,
  });

  const openBlankRuleSetForm = () => {
    setSeedRuleSet(undefined);
    setQueuedRuleSet(undefined);
    setShowRuleSetForm(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {emptyCustomConfirm.isAsking && (
        <EmptyCustomConfirmDialog verb={verbPhrase(tabForOperation)} subject={effectSubject} onAnswer={emptyCustomConfirm.answer} />
      )}
      {/* Hidden while a rule set is being added or edited: the form is a
          focused sub-flow with its own header and Back button, and the tier
          picker above it is disabled then anyway. */}
      {!showRuleSetForm && (
      <div className="flex shrink-0 flex-col gap-3">
        <div>
          <div className="mb-2">
            <p className="text-sm font-semibold text-foreground">Who can access this?</p>
            <p className="text-xs text-muted-foreground">
              Choose the access level for this operation.
            </p>
          </div>
          <AccessTierTiles
            level={level}
            isRowLevel={isRowLevel}
            selectedType={selectedAccessType}
            disabled={showRuleSetForm}
            onPick={handleTierPick}
          />
        </div>
        <AccessEffectLine effect={effect} />
      </div>
      )}

      {/* Always the flex-1 element, even when it renders nothing (any tier
          but Custom): without one, the column below the tiles has nothing to
          grow into, and the footer settles right under the warning banner
          instead of at the panel's actual bottom.
          It also has to be a flex column itself, not just a flex *item* —
          the rule-form branch below is `flex-1` so it can stretch to fill
          this wrapper, but `flex-1` only does anything when its immediate
          parent is a flex container. Without `flex flex-col` here, that
          child just falls back to shrink-wrapping its own content, and the
          form's own Save/Cancel footer ends up stranded right under the
          last rule instead of pinned to the panel's actual bottom. */}
      <div className="flex min-h-0 flex-1 flex-col">
        {currentAccessType === ACCESS_TYPES.CUSTOM &&
          (showRuleSetForm ? (
          // The form used to snap in the instant a preset/Add was clicked; a
          // short fade + rise reads as it opening rather than a jump cut.
          // `dg-rise-in` is the shared one-shot from globals.css.
          //
          // Unlike the other branches, this isn't `overflow-y-auto`: the form
          // scrolls its own content internally and keeps its Cancel/Save
          // footer outside that scroll region, so the footer needs a bounded
          // flex height here to pin to, not a scrolling ancestor to hide in.
          <div key="rule-set-form" className="dg-rise-in flex min-h-0 flex-1 flex-col">
            <RuleSetForm
              onCancel={() => {
                setSeedRuleSet(undefined);
                setQueuedRuleSet(undefined);
                setEditingPolicy(undefined);
                setShowRuleSetForm(false);
              }}
              schemaFields={schemaFields}
              schemaName={schemaName}
              schemaId={schemaId}
              operation={operation}
              fieldNames={fieldNames}
              editingPolicy={editingPolicy}
              level={level}
              seed={seedRuleSet}
              onStage={handleRuleSetSubmit}
              isSubmitting={isSavingRuleSet}
              status={status}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            <PolicyListPane
              isLoading={isPolicyListLoading}
              policies={policies}
              schemaFields={schemaFields}
              onApplyPreset={applyPreset}
              onAddRuleSet={openBlankRuleSetForm}
              onEditPolicy={(policy) => {
                setSeedRuleSet(undefined);
                setQueuedRuleSet(undefined);
                setEditingPolicy(policy);
                setShowRuleSetForm(true);
              }}
              onDeleteSuccess={() => {
                setSuccess("Rule set deleted successfully");
                refetch();
              }}
              onDeleteError={setError}
            />
          </div>
        ))}
      </div>

      {!showRuleSetForm && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 pt-3">
          <StatusSnackbar status={status} />
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-xs text-muted-foreground">
              {hasUnsavedChanges ? "Unsaved changes" : "No changes"}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasUnsavedChanges || isUpdating || isSavingRuleSet}
              onClick={handleCancelAccessType}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!hasUnsavedChanges || isUpdating || isSavingRuleSet}
              onClick={() => void handleFinalSave()}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

