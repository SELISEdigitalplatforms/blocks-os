import { Card, CardContent } from "@/components/ui-kits/card/card";
import { UsersTable } from "./users-table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useGetUsers } from "@blocks-idp/iam/hooks/use-user";
import {
  usePreviewBulkRoleChange,
  useSubmitBulkRoleChange,
} from "@blocks-idp/iam/hooks/use-bulk-user-roles";
import {
  getEnabledOrganizationsFromPages,
  useGetEnabledOrganizationsInfinite,
  useGetOrganizationConfig,
} from "@blocks-idp/iam/hooks/use-organization";
import { useProjectStore } from "@seliseblocks/genesis-os";
import {
  UsersDateFilters,
  UsersSearchFilter,
  useUsersFilterQueryParams,
  useUsersSortQueryParams,
} from "./users-filter-toolbar";
import {
  UsersSelectTrigger,
  UsersSelectionBanner,
  UsersSelectionBar,
  type SelectTriggerState,
} from "./users-selection-bar";
import { BulkRolesDialog, type BulkRolesMode } from "./bulk-roles-dialog";
import { BulkRoleReviewDialog } from "./bulk-role-review-dialog";
import type { IBulkRoleChangePayload, IBulkRolePreviewResponse } from "@blocks-idp/iam/models/user";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { normalizeSearchQueryText } from "@blocks-idp/iam/utils/normalize-search-query";
import { useMemo, useState } from "react";

const DEFAULT_ORGANIZATION_ID = "default";
const DEFAULT_ORGANIZATION_LABEL = "Default organization";

export const Users = () => {
  const { queryParams, setQueryParams } = useUsersFilterQueryParams();
  const { sortQueryParams } = useUsersSortQueryParams();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: orgConfig } = useGetOrganizationConfig(tenantId);
  const { data: organizationsData, hasNextPage: hasMoreOrganizations } =
    useGetEnabledOrganizationsInfinite(tenantId, {
      enabled: orgConfig?.isMultiOrgEnabled === true || orgConfig?.isMultiOrgEnabled === false,
    });
  const organizations = useMemo(
    () => getEnabledOrganizationsFromPages(organizationsData?.pages),
    [organizationsData?.pages],
  );
  const hasOrganizationOptions = organizations.length > 0 || hasMoreOrganizations === true;
  const organizationIds =
    orgConfig?.isMultiOrgEnabled === true && hasOrganizationOptions
      ? (queryParams.organizationIds ?? [])
      : [];
  const canFilterByRoles =
    orgConfig?.isMultiOrgEnabled === false ||
    (orgConfig?.isMultiOrgEnabled === true && hasOrganizationOptions && organizationIds.length > 0);
  const roles = canFilterByRoles ? (queryParams.roles ?? []) : [];

  const searchText =
    queryParams["selected-filter"] === "email" ? queryParams.email : queryParams.name;

  const listFilter = {
    email: queryParams.email,
    name: queryParams.name,
    joinedOn: queryParams["joinedOn-start"] || undefined,
    lastLogin: queryParams["lastLogin-start"] || undefined,
    lastUpdatedDate: queryParams["lastUpdatedDate-start"] || undefined,
    ...(organizationIds.length > 0 ? { organizationIds } : {}),
    ...(roles.length > 0 ? { roles } : {}),
  };

  const { isLoading, isFetching, data, dataUpdatedAt } = useGetUsers({
    page: queryParams.page,
    pageSize: queryParams.pageSize,
    projectKey: tenantId,
    query: searchText,
    filter: listFilter,
    sort: sortQueryParams,
  });

  const users = useMemo(() => data?.data || [], [data?.data]);
  const matchedTotal = data?.totalCount || 0;

  // ─── Bulk selection ────────────────────────────────────────────────────────
  // All of this is local state on purpose: a selection is not shareable or
  // reload-safe, so it has no business in the URL — and keeping it local is also
  // what makes "cleared when the operator leaves the page" true for free.
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isAllMatchingSelected, setIsAllMatchingSelected] = useState(false);
  const [dialogMode, setDialogMode] = useState<BulkRolesMode | null>(null);
  const [draft, setDraft] = useState<{ mode: BulkRolesMode; roleSlugs: string[] } | null>(null);
  const [preview, setPreview] = useState<IBulkRolePreviewResponse | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);

  const previewMutation = usePreviewBulkRoleChange();
  const submitMutation = useSubmitBulkRoleChange();

  const appliedFilterCount = [
    queryParams.name,
    queryParams.email,
    queryParams["joinedOn-start"],
    queryParams["lastLogin-start"],
    queryParams["lastUpdatedDate-start"],
    organizationIds.length > 0 ? "organizations" : "",
    roles.length > 0 ? "roles" : "",
  ].filter((value) => !!value).length;

  /**
   * Roles live under an organization key, so a bulk change needs exactly one.
   * With multi-organization off there is only ever "default", which is why that
   * tenant's operator never sees an organization anywhere in this flow.
   */
  const effectiveOrganizationId =
    orgConfig?.isMultiOrgEnabled === false
      ? DEFAULT_ORGANIZATION_ID
      : organizationIds.length === 1
        ? organizationIds[0]
        : null;

  const selectTrigger: SelectTriggerState =
    appliedFilterCount === 0 ? "hidden" : effectiveOrganizationId === null ? "disabled" : "enabled";

  // How many organizations the result set could span, for the blocked message. With
  // several picked it is that many; with none picked the list spans every
  // organization the operator can see.
  const organizationSpan =
    organizationIds.length > 1 ? organizationIds.length : organizations.length;

  const organizationLabel = useMemo(() => {
    if (effectiveOrganizationId === null) return "";
    if (effectiveOrganizationId === DEFAULT_ORGANIZATION_ID) return DEFAULT_ORGANIZATION_LABEL;
    return (
      organizations.find((organization) => organization.itemId === effectiveOrganizationId)?.name ??
      effectiveOrganizationId
    );
  }, [effectiveOrganizationId, organizations]);

  const exitSelection = () => {
    setIsSelecting(false);
    setSelectedUserIds(new Set());
    setIsAllMatchingSelected(false);
    setDialogMode(null);
    setDraft(null);
    setPreview(null);
  };

  // A selection only means anything against the list that produced it. The filter
  // controls are disabled while selecting, so what this really guards is a URL edit
  // or a back/forward step — the paths that can move the list out from under a
  // selection the operator can no longer see.
  //
  // Reconciled during render rather than in an effect: an effect would let one frame
  // paint with an action bar describing rows that are no longer on screen.
  const listSignature = JSON.stringify([queryParams, sortQueryParams]);
  const [knownListSignature, setKnownListSignature] = useState(listSignature);
  if (knownListSignature !== listSignature) {
    setKnownListSignature(listSignature);
    if (isSelecting) exitSelection();
  }

  // The gate can also stop being satisfied without the list changing — an
  // organization list arriving late, for instance. Leaving selection mode on would
  // strand the operator with an action bar that has nowhere to write.
  if (isSelecting && selectTrigger !== "enabled") exitSelection();

  const selectedCount = isAllMatchingSelected ? matchedTotal : selectedUserIds.size;
  const pageSelectedCount = users.filter((user) => selectedUserIds.has(user.itemId)).length;
  const isWholePageSelected = users.length > 0 && pageSelectedCount === users.length;
  const canEscalate = isWholePageSelected && matchedTotal > users.length;

  const toggleUser = (itemId: string, checked: boolean) => {
    // Any manual tick drops back to an explicit selection: keeping the all-matching
    // scope while a row is being unticked would silently ignore the untick.
    setIsAllMatchingSelected(false);
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    setIsAllMatchingSelected(false);
    setSelectedUserIds(checked ? new Set(users.map((user) => user.itemId)) : new Set());
  };

  /**
   * Roles held, in the target organization, by at least one selected user.
   *
   * `null` means "not computable": with every matching user selected the client
   * holds one page of a much larger set, so both the list and its counts would
   * describe the wrong population. The Remove dialog degrades rather than guesses.
   */
  const heldRoleCounts = useMemo(() => {
    if (isAllMatchingSelected || !effectiveOrganizationId) return null;

    const counts: Record<string, number> = {};
    users.forEach((user) => {
      if (!selectedUserIds.has(user.itemId)) return;
      (user.roles?.[effectiveOrganizationId] ?? []).forEach((slug) => {
        counts[slug] = (counts[slug] ?? 0) + 1;
      });
    });
    return counts;
  }, [isAllMatchingSelected, effectiveOrganizationId, users, selectedUserIds]);

  /**
   * The target, built once and reused verbatim by both the preview and the submit,
   * so the number the operator approved describes the set the server acts on.
   *
   * The all-matching case sends the filter itself rather than an enumerated id list:
   * enumerating would mean paging the whole result set client-side, and the set
   * could drift between the enumeration and the submit.
   */
  const buildPayload = (mode: BulkRolesMode, roleSlugs: string[]): IBulkRoleChangePayload => ({
    organizationId: effectiveOrganizationId ?? DEFAULT_ORGANIZATION_ID,
    addRoles: mode === "add" ? roleSlugs : [],
    removeRoles: mode === "remove" ? roleSlugs : [],
    target: isAllMatchingSelected
      ? {
          filter: {
            ...listFilter,
            email: normalizeSearchQueryText(listFilter.email ?? ""),
            name: normalizeSearchQueryText(listFilter.name ?? ""),
          },
        }
      : { userIds: Array.from(selectedUserIds) },
  });

  const matchedBy = isAllMatchingSelected
    ? `Everything matching the current filter${organizationLabel ? ` in ${organizationLabel}` : ""}`
    : `${selectedUserIds.size} explicitly selected users`;

  const handleContinue = async (roleSlugs: string[]) => {
    if (!dialogMode) return;

    try {
      const response = await previewMutation.mutateAsync(buildPayload(dialogMode, roleSlugs));
      if (!response.isSuccess) return showErrorToast({ errors: response.errors });

      setDraft({ mode: dialogMode, roleSlugs });
      setPreview(response);
      setDialogMode(null);
    } catch (error) {
      // Selection mode and the selection both survive, so the operator can narrow
      // the filter and retry without rebuilding what they picked.
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const handleSubmit = async () => {
    if (!draft) return;

    try {
      const response = await submitMutation.mutateAsync(buildPayload(draft.mode, draft.roleSlugs));
      if (!response.isSuccess) return showErrorToast({ errors: response.errors });

      const verb = draft.mode === "add" ? "Adding" : "Removing";
      const affected = preview?.affectedCount ?? response.matchedCount;
      const direction = draft.mode === "add" ? "to" : "from";

      // The only feedback there is. The worker reports nothing back, so the copy
      // says the work is queued rather than done.
      showSuccessToast({
        title: "Submitted successfully",
        description: `${verb} ${draft.roleSlugs.join(", ")} ${direction} ${affected} users. This runs in the background.`,
      });
      setSubmittedAt(Date.now());
      exitSelection();
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  // The refetch the submit kicks off can legitimately come back with the old roles,
  // because IAM answers 202 before its worker has written anything. Dimming rather
  // than showing the skeleton keeps the rows on screen and stops the moment reading
  // as "done and reloaded". Derived from the data's own timestamp, so it clears
  // itself the instant that refetch lands and never needs an effect to untangle.
  const isAwaitingRefresh =
    submittedAt !== null && (dataUpdatedAt ?? 0) <= submittedAt && isFetching;

  const isUserLoading = isLoading || isFetching;
  const showSkeleton = isUserLoading && !isAwaitingRefresh;
  const isBusy = previewMutation.isPending || submitMutation.isPending;

  const onPageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };

  return (
    <Card>
      <CardContent>
        <div
          data-testid="users-filter-row"
          className="mb-6 flex w-full min-w-0 flex-row items-center gap-2"
        >
          {/* A native disabled fieldset locks every control inside without the
              toolbar components needing to know selection mode exists. */}
          <fieldset
            disabled={isSelecting}
            data-testid="users-filter-controls"
            className="flex min-w-0 flex-1 flex-row items-center gap-2 disabled:opacity-60"
          >
            <div
              data-testid="users-search-filter-slot"
              className="min-w-0 flex-1 overflow-hidden sm:flex-none"
            >
              <UsersSearchFilter />
            </div>
            <div data-testid="users-advanced-filter-slot" className="shrink-0">
              <UsersDateFilters />
            </div>
          </fieldset>

          <UsersSelectTrigger
            state={selectTrigger}
            isSelecting={isSelecting}
            organizationSpan={organizationSpan}
            onEnterSelection={() => setIsSelecting(true)}
            onCancelSelection={exitSelection}
          />
        </div>

        {isSelecting && (canEscalate || isAllMatchingSelected) && (
          <UsersSelectionBanner
            pageSelectedCount={pageSelectedCount}
            matchedTotal={matchedTotal}
            isAllMatchingSelected={isAllMatchingSelected}
            onSelectAllMatching={() => setIsAllMatchingSelected(true)}
            onSelectPageOnly={() => toggleAllOnPage(true)}
            onClearSelection={() => {
              setIsAllMatchingSelected(false);
              setSelectedUserIds(new Set());
            }}
          />
        )}

        <div
          aria-busy={isAwaitingRefresh}
          className={isAwaitingRefresh ? "opacity-60 transition-opacity" : undefined}
        >
          <UsersTable
            users={users}
            isLoading={showSkeleton}
            selectionMode={isSelecting}
            selectedUserIds={selectedUserIds}
            onToggleUser={toggleUser}
            onToggleAllOnPage={toggleAllOnPage}
          />
        </div>

        {!isUserLoading && data && data.totalCount > queryParams.pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              compact
              page={queryParams.page}
              pageSize={queryParams.pageSize}
              totalCount={data?.totalCount || 0}
              pageSizeOptions={[5, 10]}
              onChange={onPageChangeHandler}
              onPageSizeChange={(pageSize) =>
                setQueryParams((params) => ({ ...params, pageSize, page: 1 }))
              }
            />
          </div>
        )}

        {isSelecting && selectedCount > 0 && (
          <UsersSelectionBar
            selectedCount={selectedCount}
            organizationLabel={organizationLabel}
            isBusy={isBusy}
            onAddRoles={() => setDialogMode("add")}
            onRemoveRoles={() => setDialogMode("remove")}
            onCancel={exitSelection}
          />
        )}

        {dialogMode !== null && (
          <BulkRolesDialog
            open
            mode={dialogMode}
            projectKey={tenantId}
            organizationLabel={organizationLabel}
            selectedCount={selectedCount}
            heldRoleCounts={dialogMode === "remove" ? heldRoleCounts : null}
            isBusy={previewMutation.isPending}
            onOpenChange={(open) => {
              if (!open) setDialogMode(null);
            }}
            onContinue={handleContinue}
          />
        )}

        {draft !== null && (
          <BulkRoleReviewDialog
            open
            mode={draft.mode}
            organizationLabel={organizationLabel}
            roleSlugs={draft.roleSlugs}
            preview={preview}
            matchedBy={matchedBy}
            isSubmitting={submitMutation.isPending}
            onOpenChange={(open) => {
              if (!open) {
                setDraft(null);
                setPreview(null);
              }
            }}
            onSubmit={handleSubmit}
          />
        )}
      </CardContent>
    </Card>
  );
};
