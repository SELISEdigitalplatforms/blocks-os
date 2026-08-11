import { AppLoadingSpinner } from "@seliseblocks/genesis-os/components";
import type { LayoutProps } from "@seliseblocks/genesis-os/layouts";
import type { Menu } from "@seliseblocks/genesis-os/types";
import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router";
import { ProjectOverviewLayout } from "@/layouts/project-overview/project-overview-layout";
import { useGetProjects } from "@/hooks/use-project";
import { useAuthStore, useProjectStore } from "@seliseblocks/genesis-os/store";

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
  const tenantGroupId = params[paramName];
  const { user } = useAuthStore();

  const { data, isLoading, isError } = useGetProjects({
    tenantGroupId: tenantGroupId,
  });
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
  if (isLoading) return <AppLoadingSpinner />;

  // getProjects filters by tenantGroupId server-side, so a non-empty result
  // means the id resolves to a real project group.
  const isValidTenantGroup = !isError && Array.isArray(data) && data.length > 0;
  if (!isValidTenantGroup) return <Navigate to={consolePath} replace />;

  // Ownership must be decided for the project in the URL, not the store's
  // `selectedProject` — the console resets that to null and the Configure button
  // never sets it, so reading the store here would reject the real owner. The
  // fetched `data` is scoped to this `tenantGroupId`, so its project is the one
  // being opened.
  const resolvedProject = data[0]?.projects?.[0];
  const isOwner = user?.sub === resolvedProject?.createdBy;
  if (!isOwner) return <Navigate to={consolePath} replace />;

  return (
    <ProjectOverviewLayout
      redirectPaths={redirectPaths}
      navigationMenus={withTenantGroup(navigationMenus, tenantGroupId, basePath)}
      forwardedTo={forwardedTo}
    >
      <Outlet />
    </ProjectOverviewLayout>
  );
}
