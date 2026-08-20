import { useQuery } from "@tanstack/react-query";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { permissionService } from "@blocks-idp/iam/services/permission.service";

/**
 * Archive-impact previews for the confirmation dialogs.
 *
 * Two hooks rather than one parameterised hook: the responses have genuinely different shapes
 * (`slug`/`activeUserCount` vs `resource`/`roleBindingCount`), and two calls that can return
 * different data must never share a query key.
 *
 * Both are guarded by the dialog's open state rather than prefetched with the list. Each row in
 * the Roles or Permissions table renders an archive action, so prefetching would fire one
 * cross-organization aggregate per row on every page load, for a dialog most rows never open.
 */
export const useRoleArchiveImpact = (id: string, { enabled }: { enabled: boolean }) =>
  useQuery({
    queryKey: ["role-archive-impact", id],
    queryFn: () => roleService.getRoleArchiveImpact(id),
    enabled: !!id && enabled,
  });

export const usePermissionArchiveImpact = (id: string, { enabled }: { enabled: boolean }) =>
  useQuery({
    queryKey: ["permission-archive-impact", id],
    queryFn: () => permissionService.getPermissionArchiveImpact(id),
    enabled: !!id && enabled,
  });
