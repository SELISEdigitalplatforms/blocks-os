import { useEffect, useState, type UIEvent } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import {
  formatEditedOn,
  lockedOut,
  withCopiesOnly,
  type ExistingCopies,
} from "@blocks-communication/mail/constants/share-organizations";
import type { OrganizationChecklistData } from "@blocks-communication/mail/hooks/use-template-copy";

interface OrganizationChecklistProps {
  data: OrganizationChecklistData;
  existing: ExistingCopies;
  selected: ReadonlyMap<string, string>;
  onSelectedChange: (selected: ReadonlyMap<string, string>) => void;
  /** Prefix for the row ids, so two lists on one page never share ids. */
  idPrefix: string;
  /** "delete": rows say whether their own copy is deleted; organizations without one can't be picked. */
  mode?: "copy" | "delete";
}

/** Loads the next page once the list is scrolled to within this many pixels of its end. */
const SCROLL_THRESHOLD = 48;

/**
 * The organizations a Default template can be copied to (SPEC33 §4: TemplateForm, CopyToOrgs):
 * search, Select all, a count, and per row whether it gets a copy, keeps its own copy or has it
 * replaced. With Keep, organizations that already have their own copy can't be selected.
 * In delete mode (SPEC34 §4: DeleteTemplateDefault) only organizations with their own copy can be
 * selected, and each row says whether that copy is deleted or kept.
 */
export function OrganizationChecklist({
  data,
  existing,
  selected,
  onSelectedChange,
  idPrefix,
  mode = "copy",
}: Readonly<OrganizationChecklistProps>) {
  const { t, language } = useT("os.communication.mail");
  const [search, setSearch] = useState("");

  const isDelete = mode === "delete";
  // The rows that can't be picked leave the selection the parent counts and sends: with Keep, those
  // that turn out to have their own copy; when deleting, those without a copy to delete.
  const pickable = (current: ReadonlyMap<string, string>) =>
    isDelete ? withCopiesOnly(current, data.copies) : lockedOut(current, data.copies, existing);

  // A copies lookup can answer after a pick, so a row can become unpickable while selected.
  useEffect(() => {
    const kept = isDelete
      ? withCopiesOnly(selected, data.copies)
      : lockedOut(selected, data.copies, existing);
    if (kept.size !== selected.size) onSelectedChange(kept);
  }, [selected, data.copies, existing, onSelectedChange, isDelete]);

  const query = search.trim().toLocaleLowerCase();
  const visible = query
    ? data.organizations.filter((organization) =>
        organization.name.toLocaleLowerCase().includes(query),
      )
    : data.organizations;
  const isLocked = (id: string) =>
    isDelete ? !data.copies.has(id) : existing === "keep" && data.copies.has(id);
  const selectable = visible.filter((organization) => !isLocked(organization.itemId));
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((organization) => selected.has(organization.itemId));
  // Counted without rows that can't be picked, even before the effect above has dropped them.
  const counted = pickable(selected);
  const toReplace =
    !isDelete && existing === "replace"
      ? [...counted.keys()].filter((id) => data.copies.has(id)).length
      : 0;

  const toggle = (id: string, name: string) => {
    const next = new Map(selected);
    if (next.has(id)) next.delete(id);
    else next.set(id, name);
    onSelectedChange(next);
  };
  const toggleAll = () => {
    const next = new Map(selected);
    for (const organization of selectable) {
      if (allVisibleSelected) next.delete(organization.itemId);
      else next.set(organization.itemId, organization.name);
    }
    onSelectedChange(next);
  };
  const loadMoreNearEnd = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (
      data.hasNextPage &&
      !data.isFetchingNextPage &&
      scrollTop + clientHeight >= scrollHeight - SCROLL_THRESHOLD
    ) {
      data.fetchNextPage();
    }
  };

  const statusOf = (id: string) => {
    const copy = data.copies.get(id);
    const checked = selected.has(id) && !isLocked(id);
    if (isDelete) {
      // A row is only "no copy" once the lookup has answered; until then (or if it failed) say so instead.
      if (!copy && data.copiesLoading)
        return { text: t("ORGANIZATION_CHECKLIST.CHECKING_COPY"), warning: false, danger: false };
      if (!copy && data.copiesError)
        return { text: t("ORGANIZATION_CHECKLIST.COPY_UNKNOWN"), warning: false, danger: false };
      if (!copy)
        return { text: t("ORGANIZATION_CHECKLIST.NO_COPY"), warning: false, danger: false };
      return checked
        ? { text: t("ORGANIZATION_CHECKLIST.DELETES_COPY"), warning: false, danger: true }
        : { text: t("ORGANIZATION_CHECKLIST.KEEPS_COPY"), warning: false, danger: false };
    }
    if (copy && existing === "replace" && checked) {
      const date = formatEditedOn(copy.lastUpdatedDate, language);
      return {
        text: date
          ? t("ORGANIZATION_CHECKLIST.REPLACES_COPY", { date })
          : t("ORGANIZATION_CHECKLIST.REPLACES_COPY_UNDATED"),
        warning: true,
        danger: false,
      };
    }
    if (copy)
      return { text: t("ORGANIZATION_CHECKLIST.KEEPS_COPY"), warning: false, danger: false };
    return {
      text: checked
        ? t("ORGANIZATION_CHECKLIST.CREATES_COPY")
        : t("ORGANIZATION_CHECKLIST.KEEPS_DEFAULT"),
      warning: false,
      danger: false,
    };
  };

  const renderRows = () => {
    if (data.isLoading) {
      return Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="px-3 py-2">
          <Skeleton className="h-6 w-full rounded" />
        </li>
      ));
    }
    if (data.isError) {
      return (
        <li className="flex flex-col items-center gap-2 px-3 py-6 text-sm">
          <span>{t("ORGANIZATION_CHECKLIST.LOAD_FAILED")}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => data.refetch()}>
            {t("EMAIL_SERVICE_TABLE.RETRY")}
          </Button>
        </li>
      );
    }
    if (visible.length === 0) {
      return (
        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
          {data.organizations.length === 0
            ? t("ORGANIZATION_CHECKLIST.EMPTY")
            : t("ORGANIZATION_CHECKLIST.NO_MATCH")}
        </li>
      );
    }
    // Shown above the rows: until it is answered, an own copy may be missing from them.
    const copiesFailed = data.copiesError ? (
      <li key="copies-failed" className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1">{t("ORGANIZATION_CHECKLIST.COPIES_FAILED")}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => data.refetchCopies()}>
          {t("EMAIL_SERVICE_TABLE.RETRY")}
        </Button>
      </li>
    ) : null;
    const rows = visible.map((organization) => {
      const locked = isLocked(organization.itemId);
      const status = statusOf(organization.itemId);
      const rowId = `${idPrefix}-${organization.itemId}`;
      return (
        <li
          key={organization.itemId}
          className={cn(
            "flex min-h-11 items-center gap-3 px-3 py-1.5",
            status.warning && "bg-warning-50",
            status.danger && "bg-destructive/10",
          )}
        >
          <Checkbox
            id={rowId}
            aria-label={organization.name}
            checked={selected.has(organization.itemId) && !locked}
            disabled={locked}
            onCheckedChange={() => toggle(organization.itemId, organization.name)}
          />
          <Label htmlFor={rowId} className="min-w-0 flex-1 truncate font-normal">
            {organization.name}
          </Label>
          {data.copies.has(organization.itemId) ? (
            <Badge variant="secondary" className="px-1.5 py-0 text-[11px] tracking-wide">
              {t("ORGANIZATION_CHECKLIST.OWN_COPY")}
            </Badge>
          ) : null}
          <span
            className={cn(
              "shrink-0 text-sm",
              status.warning && "font-medium text-warning-700",
              status.danger && "font-medium text-destructive",
              !status.warning && !status.danger && "text-muted-foreground",
            )}
          >
            {status.text}
          </span>
        </li>
      );
    });
    return [copiesFailed, ...rows];
  };

  const selectAllId = `${idPrefix}-select-all`;
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2">
        <Input
          type="search"
          className="h-10 w-full"
          aria-label={t("ORGANIZATION_CHECKLIST.SEARCH_LABEL")}
          placeholder={t("ORGANIZATION_CHECKLIST.SEARCH_PLACEHOLDER")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
        <span className="flex items-center gap-3">
          <Checkbox
            id={selectAllId}
            aria-label={t("ORGANIZATION_CHECKLIST.SELECT_ALL")}
            checked={allVisibleSelected}
            disabled={selectable.length === 0}
            onCheckedChange={toggleAll}
          />
          <Label htmlFor={selectAllId} className="font-normal">
            {t("ORGANIZATION_CHECKLIST.SELECT_ALL")}
          </Label>
        </span>
        <span className="text-muted-foreground">
          {toReplace > 0
            ? t("ORGANIZATION_CHECKLIST.SELECTED_TO_REPLACE", {
                count: counted.size,
                replace: toReplace,
              })
            : t("ORGANIZATION_CHECKLIST.SELECTED", { count: counted.size })}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto" onScroll={loadMoreNearEnd}>
        <ul className="flex flex-col py-1">{renderRows()}</ul>
      </div>
      {data.hasNextPage ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-sm text-muted-foreground">
          <span>{t("ORGANIZATION_CHECKLIST.MORE_HINT")}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={data.isFetchingNextPage}
            onClick={() => data.fetchNextPage()}
          >
            {t("ORGANIZATION_CHECKLIST.SHOW_MORE")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
