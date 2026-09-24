import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { CircleAlert, Lock, MinusCircle, PlusCircle, SquareCheck } from "lucide-react";

/**
 * Whether the Select button exists at all, and if so whether it can be used.
 *
 * Hidden rather than disabled when no filter is applied: an unfiltered list has no
 * organization to write roles into, so there is nothing to explain yet. Once a
 * filter IS applied the button appears, because from that point the operator has a
 * specific, fixable reason it might not work -- and a disabled control with a reason
 * beside it is more discoverable than a control that never appears.
 */
export type SelectTriggerState = "hidden" | "disabled" | "enabled";

export const NO_FILTER_HINT = "Filter to one organization to select users in bulk";

type UsersSelectTriggerProps = {
  state: SelectTriggerState;
  isSelecting: boolean;
  /** How many organizations the current result set spans; only read when disabled. */
  organizationSpan: number;
  onEnterSelection: () => void;
  onCancelSelection: () => void;
};

/**
 * The toolbar control. Owns all three gate states so the page never has to spell
 * out the same rule twice.
 */
export const UsersSelectTrigger = ({
  state,
  isSelecting,
  organizationSpan,
  onEnterSelection,
  onCancelSelection,
}: UsersSelectTriggerProps) => {
  if (state === "hidden") {
    return (
      <p data-testid="users-select-hint" className="shrink-0 text-xs text-muted-foreground">
        {NO_FILTER_HINT}
      </p>
    );
  }

  if (isSelecting) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="users-cancel-selection"
        onClick={onCancelSelection}
      >
        Cancel
      </Button>
    );
  }

  const isDisabled = state === "disabled";

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isDisabled && (
        <Badge variant="warning" data-testid="users-select-blocked-reason" className="gap-1">
          <CircleAlert className="h-3.5 w-3.5" aria-hidden />
          Selection spans {organizationSpan} organizations
        </Badge>
      )}
      {/* Disabled, not removed: it stays focusable-by-label and keeps the reason
          anchored to the thing it explains. The click handler is dropped rather
          than guarded, so an activated disabled button cannot fire a request. */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="users-select-trigger"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        onClick={isDisabled ? undefined : onEnterSelection}
      >
        <SquareCheck className="mr-2 h-4 w-4" aria-hidden />
        Select
      </Button>
    </div>
  );
};

type UsersSelectionBannerProps = {
  pageSelectedCount: number;
  matchedTotal: number;
  isAllMatchingSelected: boolean;
  onSelectAllMatching: () => void;
  onSelectPageOnly: () => void;
  onClearSelection: () => void;
};

/**
 * The escalation from "this page" to "everything matching".
 *
 * Only worth rendering once every row on the page is ticked and more users match
 * than fit on it -- the page decides that; this component renders whichever of the
 * two states it is told.
 */
export const UsersSelectionBanner = ({
  pageSelectedCount,
  matchedTotal,
  isAllMatchingSelected,
  onSelectAllMatching,
  onSelectPageOnly,
  onClearSelection,
}: UsersSelectionBannerProps) => {
  if (isAllMatchingSelected) {
    const offPageCount = Math.max(matchedTotal - pageSelectedCount, 0);

    return (
      <div
        data-testid="users-selection-banner-all"
        className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg bg-warning-100 px-4 py-2.5 text-center text-sm text-warning-700"
      >
        <span>
          All <strong>{matchedTotal} users matching these filters</strong> are selected — including{" "}
          {offPageCount} not shown on this page.
        </span>
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0"
          data-testid="users-clear-selection"
          onClick={onClearSelection}
        >
          Clear selection
        </Button>
        <span aria-hidden>·</span>
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0"
          data-testid="users-select-page-only"
          onClick={onSelectPageOnly}
        >
          Select all on this page
        </Button>
      </div>
    );
  }

  return (
    <div
      data-testid="users-selection-banner-page"
      className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg bg-muted px-4 py-2.5 text-center text-sm text-muted-foreground"
    >
      <span>
        All <strong>{pageSelectedCount} users on this page</strong> are selected.
      </span>
      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto p-0"
        data-testid="users-select-all-matching"
        onClick={onSelectAllMatching}
      >
        Select all {matchedTotal} users matching these filters
      </Button>
    </div>
  );
};

type UsersSelectionBarProps = {
  selectedCount: number;
  organizationLabel: string;
  /** True while a preview or submit is in flight, so a second action cannot be started. */
  isBusy: boolean;
  onAddRoles: () => void;
  onRemoveRoles: () => void;
  onCancel: () => void;
};

/**
 * The fixed action bar. Deliberately shaped around a verb list rather than a single
 * button, so adding a future bulk action is a new entry here and not a new layout.
 */
export const UsersSelectionBar = ({
  selectedCount,
  organizationLabel,
  isBusy,
  onAddRoles,
  onRemoveRoles,
  onCancel,
}: UsersSelectionBarProps) => (
  <div
    data-testid="users-selection-bar"
    role="region"
    aria-label="Bulk actions"
    className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-3 border-t bg-card px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)]"
  >
    <span className="text-sm font-semibold text-high-emphasis">{selectedCount} selected</span>

    {/* Non-interactive on purpose: the organization comes from the page filter and
        changing it here would silently change who is affected. The padlock is the
        whole message. */}
    <Badge
      variant="secondary"
      data-testid="users-selection-organization"
      className="gap-1 font-normal"
    >
      <Lock className="h-3.5 w-3.5" aria-hidden />
      {organizationLabel}
    </Badge>

    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        data-testid="users-bulk-add-roles"
        disabled={isBusy}
        onClick={onAddRoles}
      >
        <PlusCircle className="mr-2 h-4 w-4" aria-hidden />
        Add roles
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive-outline"
        data-testid="users-bulk-remove-roles"
        disabled={isBusy}
        onClick={onRemoveRoles}
      >
        <MinusCircle className="mr-2 h-4 w-4" aria-hidden />
        Remove roles
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-testid="users-bulk-cancel"
        disabled={isBusy}
        onClick={onCancel}
      >
        Cancel
      </Button>
    </div>
  </div>
);
