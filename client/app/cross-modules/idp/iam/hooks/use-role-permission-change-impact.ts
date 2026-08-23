import { useQuery } from "@tanstack/react-query";
import { roleService } from "@blocks-idp/iam/services/role.service";
import { IRolePermissionChangeImpactPayload } from "@blocks-idp/iam/models/role-permission-change-impact.model";

/**
 * Impact preview for a pending role permission diff, driving the save confirmation dialog.
 *
 * Guarded by the dialog's open state rather than recomputed as the user ticks permissions: the
 * query is a cross-organization aggregate, and firing one per checkbox click would put a request
 * behind every toggle on the page.
 *
 * The diff is part of the query key, so re-opening the dialog after changing the selection fetches
 * fresh numbers instead of serving the previous selection's. The ids are sorted first -- the same
 * set arrived at in a different click order is the same question, and must not be a cache miss.
 */
export const useRolePermissionChangeImpact = (
  payload: IRolePermissionChangeImpactPayload,
  { enabled }: { enabled: boolean },
) =>
  useQuery({
    queryKey: [
      "role-permission-change-impact",
      payload.organizationId,
      payload.slug,
      [...payload.addPermissions].sort(),
      [...payload.removePermissions].sort(),
    ],
    queryFn: () => roleService.getRolePermissionChangeImpact(payload),
    enabled:
      enabled &&
      !!payload.slug &&
      (payload.addPermissions.length > 0 || payload.removePermissions.length > 0),
    // The counts are a snapshot taken to be acted on immediately. Serving a cached answer from an
    // earlier visit would let the user consent to numbers that have since moved.
    staleTime: 0,
    gcTime: 0,
  });
