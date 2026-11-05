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
}

/** Loads the next page once the list is scrolled to within this many pixels of its end. */
const SCROLL_THRESHOLD = 48;

/**
 * The organizations a Default template can be copied to (SPEC33 §4: TemplateForm, CopyToOrgs):
 * search, Select all, a count, and per row whether it gets a copy, keeps its own copy or has it
 * replaced. With Keep, organizations that already have their own copy can't be selected.
 */
export function OrganizationChecklist({
  data,
  existing,
  selected,
  onSelectedChange,
  idPrefix,
}: Readonly<OrganizationChecklistProps>) {
  const { t, language } = useT("os.communication.mail");
  const [search, setSearch] = useState("");

  // A copies lookup can answer after a pick: with Keep, an organization that turns out to have its
  // own copy can't stay selected, so it leaves the selection the parent counts and sends.
  useEffect(() => {
    const kept = lockedOut(selected, data.copies, existing);
    if (kept.size !== selected.size) onSelectedChange(kept);
  }, [selected, data.copies, existing, onSelectedChange]);

  const query = search.trim().toLocaleLowerCase();
  const visible = query
    ? data.organizations.filter((organization) =>
        organization.name.toLocaleLowerCase().includes(query),
      )
    : data.organizations;
  const isLocked = (id: string) => existing === "keep" && data.copies.has(id);
  const selectable = visible.filter((organization) => !isLocked(organization.itemId));
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((organization) => selected.has(organization.itemId));
  // Counted without rows Keep locks, even before the effect below has dropped them.
  const counted = lockedOut(selected, data.copies, existing);
  const toReplace =
    existing === "replace" ? [...counted.keys()].filter((id) => data.copies.has(id)).length : 0;

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
    if (copy && existing === "replace" && checked) {
      const date = formatEditedOn(copy.lastUpdatedDate, language);
      return {
        text: date
          ? t("ORGANIZATION_CHECKLIST.REPLACES_COPY", { date })
          : t("ORGANIZATION_CHECKLIST.REPLACES_COPY_UNDATED"),
        warning: true,
      };
    }
    if (copy) return { text: t("ORGANIZATION_CHECKLIST.KEEPS_COPY"), warning: false };
    return {
      text: checked
        ? t("ORGANIZATION_CHECKLIST.CREATES_COPY")
        : t("ORGANIZATION_CHECKLIST.KEEPS_DEFAULT"),
      warning: false,
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
              status.warning ? "font-medium text-warning-700" : "text-muted-foreground",
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
