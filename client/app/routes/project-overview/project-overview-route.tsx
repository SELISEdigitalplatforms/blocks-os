import { useProjectPermissions } from "@/hooks/use-project-access";
import { useGetProjects } from "@/hooks/use-project";
import { ProjectOverviewLayout } from "@/layouts/project-overview/project-overview-layout";
import { AppLoadingSpinner } from "@seliseblocks/genesis-os/components";
import type { LayoutProps } from "@seliseblocks/genesis-os/layouts";
import { useProjectStore } from "@seliseblocks/genesis-os/store";
import type { Menu } from "@seliseblocks/genesis-os/types";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router";

export type ProjectOverviewRouteProps = LayoutProps & {
  /** Base path the project-overview routes live under. */
  basePath?: "/app/project";
  /** Where to redirect when no tenant-group id is present in the URL. */
  consolePath?: "/app/console";
  /** Route param that holds the tenant-group id. */
  paramName?: string;
};

/**
 * Rewrites project-overview menu paths (`<basePath>/<sub>`) to carry the active
 * tenant-group id (`<basePath>/<tenantGroupId>/<sub>`) so sidebar links match
 * the id-scoped routes. Menus outside the project-overview subtree are left
 * untouched.
 */
const withTenantGroup = (menus: Menu[], tenantGroupId: string, basePath: string): Menu[] => {
  const prefix = `${basePath}/`;
  return menus.map((menu) => {
    if (menu.type === "menu" && menu.path.startsWith(prefix)) {
      return {
        ...menu,
        path: `${prefix}${tenantGroupId}/${menu.path.slice(prefix.length)}`,
      };
    }
    return menu;
  });
};

/**
 * Hides the project-overview menus a contributor has not been granted.
 *
 * `granted === null` means an owner — every menu stays. Menus outside the project-overview
 * subtree are never touched: they belong to the impersonated environment routes, which are
 * governed by environment membership rather than by project grants.
 *
 * Separators are dropped when nothing follows them, so a filtered sidebar does not end in a
 * rule floating under the last item.
 */
const visibleMenus = (menus: Menu[], granted: string[] | null, basePath: string): Menu[] => {
  if (granted === null) return menus;

  const allowed = new Set(granted);
  const kept = menus.filter(
    (menu) => menu.type !== "menu" || !menu.path.startsWith(`${basePath}/`) || allowed.has(menu.id),
  );

  return kept.filter((menu, index) => {
    if (menu.type !== "separator") return true;
    const next = kept.slice(index + 1).find((item) => item.type === "menu");
    return Boolean(next);
  });
};

/**
 * The menu a URL belongs to: the segment after the tenant-group id.
 *
 * `people/:id` resolves to `people`, so a person detail page is governed by the same grant as
 * the list it came from. Returns null for the index route, which redirects on its own.
 */
const requestedMenuId = (pathname: string, tenantGroupId: string, basePath: string) => {
  const prefix = `${basePath}/${tenantGroupId}/`;
  if (!pathname.startsWith(prefix)) return null;

  const [segment] = pathname.slice(prefix.length).split("/");
  return segment || null;
};

/**
 * Route element for `<basePath>/:tenantGroupId/*`.
 *
 * Makes the URL the source of truth for the selected project: hydrates the
 * store from the `:tenantGroupId` param (so browser back/forward, deep-links,
 * and refresh all restore the selection), redirects to the console when the id
 * is missing or does not resolve to a real project group, and feeds id-scoped
 * menu paths to the shared layout. Compose it as the route element and render
 * child routes through its `<Outlet />`.
 */
export function ProjectOverviewRoute({
  redirectPaths,
  navigationMenus,
  forwardedTo,
  basePath = "/app/project",
  consolePath = "/app/console",
  paramName = "tenantGroupId",
}: ProjectOverviewRouteProps) {
  const params = useParams();
  const location = useLocation();
  const tenantGroupId = params[paramName];

  const { data, isLoading, isError } = useGetProjects({
    tenantGroupId: tenantGroupId,
  });

  // Ownership is no longer the whole gate: an owner can grant a shared member access to
  // individual menus, and anyone holding at least one is entitled to open the shell.
  const {
    isLoading: isAccessLoading,
    isOwner,
    hasAnyAccess,
    menuIds,
  } = useProjectPermissions(tenantGroupId);
  const setTenantGroup = useProjectStore((state) => state.setTenantGroup);
  const setSelectedProject = useProjectStore((state) => state.setSelectedProject);

  // Make the URL the source of truth for the selected project: once the id
  // resolves to a real group, push it into the shared store so the sub-pages
  // (environments/people/repositories/settings) — which read
  // `selectedTenantGroup` from the store, not the URL — work on deep-link,
  // refresh, and back/forward, not only after clicking a project card.
  useEffect(() => {
    if (!tenantGroupId || !Array.isArray(data) || data.length === 0) return;
    setTenantGroup(tenantGroupId);
    const project = data[0]?.projects?.[0];
    if (project) setSelectedProject(project);
  }, [tenantGroupId, data, setTenantGroup, setSelectedProject]);

  if (!tenantGroupId) return <Navigate to={consolePath} replace />;
  if (isLoading || isAccessLoading) return <AppLoadingSpinner />;

  // getProjects filters by tenantGroupId server-side, so a non-empty result
  // means the id resolves to a real project group.
  const isValidTenantGroup = !isError && Array.isArray(data) && data.length > 0;
  if (!isValidTenantGroup) return <Navigate to={consolePath} replace />;

  // Standing must be decided for the project in the URL, not the store's `selectedProject` —
  // the console resets that to null and the Configure button never sets it, so reading the
  // store here would reject the real owner. GetMyAccess is scoped to this `tenantGroupId`.
  //
  // A contributor with no grants at all still bounces: an empty sidebar reads as a broken page,
  // not as a permissions boundary.
  if (!hasAnyAccess) return <Navigate to={consolePath} replace />;

  // Filtering the sidebar hides the links but does nothing about a typed URL or an old
  // bookmark. The server refuses the data either way, so this is not the security boundary —
  // it is what stops a contributor landing on a page of failed requests.
  const requested = requestedMenuId(location.pathname, tenantGroupId, basePath);
  if (!isOwner && requested && !menuIds.includes(requested)) {
    const fallback = menuIds[0];
    return (
      <Navigate to={fallback ? `${basePath}/${tenantGroupId}/${fallback}` : consolePath} replace />
    );
  }

  return (
    <ProjectOverviewLayout
      redirectPaths={redirectPaths}
      navigationMenus={visibleMenus(
        withTenantGroup(navigationMenus, tenantGroupId, basePath),
        isOwner ? null : menuIds,
        basePath,
      )}
      forwardedTo={forwardedTo}
    >
      <Outlet />
    </ProjectOverviewLayout>
  );
}
