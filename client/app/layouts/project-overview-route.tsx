import { AppLoadingSpinner } from "@seliseblocks/blocks-kit/components";
import type { LayoutProps } from "@seliseblocks/blocks-kit/layouts";
import type { Menu } from "@seliseblocks/blocks-kit/types";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { ProjectOverviewLayout } from "./project-overview-layout";
import { useGetProjects } from "@/hooks/use-project";
import { useAuthStore, useProjectStore } from "@seliseblocks/blocks-kit/store";

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
const withTenantGroup = (
  menus: Menu[],
  tenantGroupId: string,
  basePath: string,
): Menu[] => {
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
  const { selectedProject } = useProjectStore();

  const { data, isLoading, isError } = useGetProjects({
    tenantGroupId: tenantGroupId,
  });

  if (!tenantGroupId) return <Navigate to={consolePath} replace />;
  if (isLoading) return <AppLoadingSpinner />;

  // getProjects filters by tenantGroupId server-side, so a non-empty result
  // means the id resolves to a real project group.
  const isValidTenantGroup = !isError && Array.isArray(data) && data.length > 0;
  if (!isValidTenantGroup) return <Navigate to={consolePath} replace />;

  const isOwner = user?.sub === selectedProject?.createdBy;
  if (!isOwner) return <Navigate to={consolePath} replace />;

  return (
    <ProjectOverviewLayout
      redirectPaths={redirectPaths}
      navigationMenus={withTenantGroup(
        navigationMenus,
        tenantGroupId,
        basePath,
      )}
      forwardedTo={forwardedTo}>
      <Outlet />
    </ProjectOverviewLayout>
  );
}
