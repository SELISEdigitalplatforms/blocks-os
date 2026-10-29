import { useMemo, useState } from "react";
import { Package, Users, BookMinus, Settings, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useSaveAccessPolicy } from "@/hooks/use-project-access";
import { IMenuGrant, toPolicy, VIEW_ACTION } from "@blocks-identifier/models/project-access.model";
import { cn } from "@/lib/utils";

/**
 * Labels and destructive markers for the grant catalog.
 *
 * The stored catalog is ids only — `{ people: ["view", "invite", "remove"] }` — so the wording
 * lives here, where the rest of the interface copy does. A menu or action the catalog gains
 * before this map does still renders, falling back to its id, rather than disappearing.
 */
const MENU_LABELS: Record<string, string> = {
  environments: "Environments",
  people: "People",
  repositories: "Repositories",
  settings: "Project Settings",
};

const MENU_ICONS: Record<string, typeof Package> = {
  environments: Package,
  people: Users,
  repositories: BookMinus,
  settings: Settings,
};

const ACTION_LABELS: Record<string, string> = {
  "environments::view": "View environments",
  "environments::migrate": "Start migration",
  "people::view": "View members",
  "people::invite": "Invite people",
  "people::remove": "Remove access",
  "repositories::view": "View repositories",
  "repositories::add": "Add repository",
  "repositories::delete": "Delete repository",
  "settings::view": "View settings",
  "settings::rename": "Rename project",
};

/** What a grant actually does, where that is not obvious from the label. */
const ACTION_WARNINGS: Record<string, string> = {
  "environments::migrate": "Overwrites data in the target environment",
  "people::remove": "Revokes a person from the project",
  "repositories::delete": "Tears down running deployments",
};

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

export interface PeopleAccessTabProps {
  projectGroupId: string;
  userId: string;
  /** Only an owner can read or write another member's grants, so the card is theirs alone. */
  isViewerOwner: boolean;
  /**
   * Everything that may be granted. Comes from the viewer's own GetMyAccess — an owner holds
   * the whole catalog, so their menus *are* the catalog. Rendering this first means the form
   * shows every menu whether or not the person being edited holds any of them.
   */
  catalogMenus: IMenuGrant[];
  /** The person's stored grants, from the People list. Mapped onto the catalog above. */
  accessPolicies: string[];
  /** Owners hold everything implicitly; there is nothing to grant them. */
  isTargetOwner: boolean;
  isLoading?: boolean;
}

export const PeopleAccessTab = ({
  projectGroupId,
  userId,
  isViewerOwner,
  catalogMenus,
  accessPolicies,
  isTargetOwner,
  isLoading = false,
}: PeopleAccessTabProps) => {
  const { mutateAsync: save, isPending } = useSaveAccessPolicy();

  const saved = useMemo(() => accessPolicies ?? [], [accessPolicies]);

  // The catalog drives the form; the person's grants only tick boxes in it.
  const catalog = useMemo(
    () =>
      Object.fromEntries(catalogMenus.map((menu) => [menu.menuId, menu.actions])) as Record<
        string,
        string[]
      >,
    [catalogMenus],
  );

  // The edit lives in a draft that starts as null and is cleared again after a save, so the
  // stored value flows straight through until the owner actually changes something. Mirroring
  // `saved` into state through an effect would re-render on every fetch and fight the refetch
  // that follows a save.
  const [draft, setDraft] = useState<string[] | null>(null);
  const selected = draft ?? saved;

  const setSelected = (update: (current: string[]) => string[]) =>
    setDraft((current) => update(current ?? saved));

  const isDirty = !sameSet(selected, saved);

  const toggle = (menuId: string, action: string, checked: boolean) => {
    const policy = toPolicy(menuId, action);

    setSelected((current) => {
      const next = checked
        ? [...current, policy]
        : current.filter((entry) => entry !== policy);

      // "view" is implied by any other action on the same menu, so a grant can never exist
      // without the read it depends on. Applied here as well as server-side, so the checkbox
      // shows the state that will actually be stored.
      const menuActions = catalog[menuId] ?? [];
      const holdsOther = menuActions.some(
        (candidate) => candidate !== VIEW_ACTION && next.includes(toPolicy(menuId, candidate)),
      );
      const view = toPolicy(menuId, VIEW_ACTION);

      if (holdsOther && menuActions.includes(VIEW_ACTION) && !next.includes(view)) {
        next.push(view);
      }

      return Array.from(new Set(next));
    });
  };

  const onSave = async () => {
    try {
      const response = await save({ projectGroupId, userId, accessPolicies: selected });
      if (response?.isSuccess) {
        // Back to following the server: the refetch this save triggers is now the source again.
        setDraft(null);
        showSuccessToast({ description: "Access updated." });
      } else {
        showErrorToast({ errors: response?.errors });
      }
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: (error as { errors: unknown }).errors });
      }
    }
  };

  // Owners hold every menu implicitly and store no policy, so there is nothing to show them:
  // not a form, and not an empty card explaining why there is no form.
  if (!isViewerOwner || isTargetOwner) return null;

  if (isLoading) {
    return (
      <Card className="p-0">
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const menuIds = Object.keys(catalog);
  const grantedMenus = menuIds.filter((menuId) =>
    (catalog[menuId] ?? []).some((action) => selected.includes(toPolicy(menuId, action))),
  );

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b p-5">
        <h2 className="text-base font-semibold">Project access</h2>
        <p className="mt-1 text-sm text-medium-emphasis">
          Choose what this person can do in this project. They will only see the menus you grant.
          Environment access is managed above.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-5">
        {grantedMenus.length === 0 && (
          <div className="rounded-lg border border-l-[3px] border-l-warning-500 bg-surface p-3 text-sm">
            <p className="font-semibold">No access yet</p>
            <p className="text-medium-emphasis">
              Until at least one menu is granted, this person is sent back to the console when they
              open the project.
            </p>
          </div>
        )}

        {menuIds.map((menuId) => {
          const actions = catalog[menuId] ?? [];
          const on = actions.filter((action) => selected.includes(toPolicy(menuId, action)));
          const holdsOther = on.some((action) => action !== VIEW_ACTION);
          const Icon = MENU_ICONS[menuId] ?? Package;
          const isActive = on.length > 0;

          return (
            <div
              key={menuId}
              className={cn(
                "overflow-hidden rounded-lg border",
                isActive && "border-blocks-primary-200",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3",
                  isActive ? "bg-blocks-primary-50" : "bg-surface",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg border bg-white",
                    isActive
                      ? "border-blocks-primary-200 text-blocks-primary-500"
                      : "text-medium-emphasis",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{MENU_LABELS[menuId] ?? menuId}</span>
                <span className="ml-auto text-xs text-medium-emphasis">
                  {on.length ? `${on.length} of ${actions.length}` : "none"}
                </span>
              </div>

              <div className="flex flex-col p-1.5">
                {actions.map((action) => {
                  const policy = toPolicy(menuId, action);
                  const isView = action === VIEW_ACTION;
                  const warning = ACTION_WARNINGS[policy];

                  return (
                    <label
                      key={policy}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 hover:bg-surface"
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selected.includes(policy)}
                        // Locked on, not merely checked: unticking it while another action on the
                        // same menu is granted would ask for a state the server will not store.
                        disabled={isView && holdsOther}
                        onCheckedChange={(checked) => toggle(menuId, action, checked === true)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm">{ACTION_LABELS[policy] ?? action}</span>
                        {warning && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-warning-700">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {warning}
                          </span>
                        )}
                        {isView && holdsOther && (
                          <span className="mt-0.5 block text-xs text-medium-emphasis">
                            Included with the actions below
                          </span>
                        )}
                      </span>
                      <span className="ml-auto hidden shrink-0 pt-0.5 font-mono text-[11px] text-low-emphasis sm:block">
                        {policy}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-surface px-5 py-3.5">
        <span className="text-sm text-medium-emphasis">
          {grantedMenus.length === 0
            ? "No menus granted"
            : `${grantedMenus.length} of ${menuIds.length} menus granted`}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!isDirty || isPending} onClick={() => setDraft(null)}>
            Cancel
          </Button>
          <Button disabled={!isDirty || isPending} onClick={onSave}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
