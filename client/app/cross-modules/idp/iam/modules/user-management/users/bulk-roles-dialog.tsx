import { FilterControls } from "@/components/filter-toolbar";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";

export type BulkRolesMode = "add" | "remove";

export type BulkRolesDialogProps = {
  open: boolean;
  mode: BulkRolesMode;
  projectKey: string;
  /** Shown in the locked field; never editable here (see the field's own note). */
  organizationLabel: string;
  selectedCount: number;
  /**
   * Roles held in the target organization by at least one selected user, with how
   * many hold each. `null` means the held set is not computable -- which is exactly
   * the all-matching case, where the client holds one page of a much larger set.
   */
  heldRoleCounts: Record<string, number> | null;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (roleSlugs: string[]) => void;
};

const PAGE_SIZE = 10;

/**
 * Pick the roles for a bulk add or a bulk remove.
 *
 * One component with a `mode` rather than two files: the two differ only in where
 * the role list comes from, the per-row caption and the copy. Keeping them together
 * is what guarantees the locked organization field, the search, the pagination and
 * the footer stay identical -- the places where a drifting copy would quietly change
 * what the operator thinks they are about to do.
 *
 * There is deliberately **no role cap** anywhere in here. None exists server-side,
 * and the single-user Assign Role dialog's own 5-role guard is that component's
 * behaviour, not a rule about roles.
 */
export const BulkRolesDialog = ({
  open,
  mode,
  projectKey,
  organizationLabel,
  selectedCount,
  heldRoleCounts,
  isBusy,
  onOpenChange,
  onContinue,
}: BulkRolesDialogProps) => {
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  // No reset logic here on purpose: the page mounts this dialog only while it is
  // open, so every open starts from fresh state. A cancelled draft therefore cannot
  // leak into the next action -- including a switch straight from Add to Remove,
  // where a carried-over tick would mean the opposite of what it did a moment ago.

  const heldSlugs = useMemo(
    () => (heldRoleCounts ? Object.keys(heldRoleCounts) : null),
    [heldRoleCounts],
  );

  /**
   * In remove mode with a known held set we ask for exactly those slugs in one
   * page, so the list is the held set itself rather than a general page of roles
   * filtered down to whatever happened to land on it. Everywhere else the list is
   * the ordinary searchable, paginated role list.
   */
  const isHeldScoped = mode === "remove" && heldSlugs !== null;

  const { data, isLoading } = useGetRoles(
    isHeldScoped
      ? {
          page: 0,
          pageSize: Math.max(heldSlugs.length, 1),
          projectKey,
          sort: { property: "Name", isDescending: false },
          filter: { slugs: heldSlugs },
        }
      : {
          page,
          pageSize: PAGE_SIZE,
          projectKey,
          sort: { property: "Name", isDescending: false },
          filter: { search },
        },
    { enabled: open && !(isHeldScoped && heldSlugs.length === 0) },
  );

  const roles = useMemo(() => data?.data ?? [], [data?.data]);
  const totalCount = data?.totalCount ?? 0;

  const isRemove = mode === "remove";
  const title = isRemove ? "Remove roles" : "Add roles";
  const subtitle = isRemove
    ? `${selectedCount} users selected · only the roles they hold in this organization are listed`
    : `${selectedCount} users selected · roles are added, existing roles are kept`;

  const toggle = (slug: string, checked: boolean) =>
    setSelectedSlugs((current) =>
      checked ? [...current, slug] : current.filter((value) => value !== slug),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-left">{title}</DialogTitle>
          <DialogDescription className="text-left">{subtitle}</DialogDescription>
        </DialogHeader>

        {/* Read-only by design: the organization comes from the page filter, which is
            also what made the selection possible. Offering a choice here would let
            the operator write into an organization the matched users may not be in. */}
        <div
          data-testid="bulk-roles-organization"
          className="rounded-lg border bg-muted/40 px-3 py-2.5"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Organization
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-high-emphasis">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {organizationLabel}
            <span className="font-normal text-muted-foreground">· from the page filter</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each user&rsquo;s roles in other organizations are untouched.
          </p>
        </div>

        {!isHeldScoped && (
          <FilterControls.SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(0);
            }}
            className="h-fit w-full py-3"
            placeholder="Search roles"
          />
        )}

        <Card>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {isLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <div key={index} className="flex animate-pulse items-center space-x-2 py-2">
                    <div className="h-4 w-4 rounded bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                  </div>
                ))
              ) : roles.length > 0 ? (
                roles.map((role) => {
                  const heldCount = heldRoleCounts?.[role.slug];

                  return (
                    <div key={role.itemId} className="col-span-1 flex items-center py-2">
                      <Checkbox
                        id={`bulk-role-${role.slug}`}
                        checked={selectedSlugs.includes(role.slug)}
                        onCheckedChange={(value) => toggle(role.slug, !!value)}
                      />
                      <label
                        htmlFor={`bulk-role-${role.slug}`}
                        className="ml-2 flex cursor-pointer flex-col"
                      >
                        <span className="max-w-[180px] truncate" title={role.name}>
                          {role.name}
                        </span>
                        <span
                          className="max-w-[180px] truncate text-sm text-muted-foreground"
                          title={role.slug}
                        >
                          {isRemove && heldCount !== undefined
                            ? `Held by ${heldCount} of the ${selectedCount} selected users`
                            : role.slug}
                        </span>
                      </label>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full flex h-24 items-center justify-center text-sm text-muted-foreground">
                  No roles found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* The honest version of a number we cannot compute: with every matching user
            selected, only this page's records are loaded, so "held by N" would be a
            count of the wrong population. The preview step reports the real one. */}
        {isRemove && heldRoleCounts === null && (
          <p data-testid="bulk-roles-counts-unavailable" className="text-xs text-muted-foreground">
            Counts are unavailable when every matching user is selected. The next step reports
            exactly how many users each role would affect.
          </p>
        )}

        {!isLoading && !isHeldScoped && totalCount > PAGE_SIZE && (
          <div className="flex items-center md:justify-end">
            <Pagination
              page={page}
              onChange={setPage}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="default"
            disabled={isBusy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="default"
            data-testid="bulk-roles-continue"
            disabled={isBusy || selectedSlugs.length === 0}
            onClick={() => onContinue(selectedSlugs)}
          >
            {isBusy ? "Checking…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
