import type {
  IBulkRoleChangePayload,
  IBulkRolePreviewResponse,
  IBulkRoleSubmitResponse,
} from "@blocks-idp/iam/models/user";
import { userService } from "@blocks-idp/iam/services/user.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Query prefixes a successful submit invalidates.
 *
 * IAM answers the submit with a 202 before its worker has written anything, so the
 * refetch these trigger can legitimately come back with the old roles still on the
 * rows. That is why nothing in the UI claims the change is already live (see the
 * table's dimmed-refetch behaviour on the Users page) -- the invalidation exists so
 * the list is correct as soon as the worker catches up, not to prove it already is.
 */
export const BULK_ROLE_INVALIDATED_QUERY_KEYS = [
  ["users"],
  ["user-by-id"],
  ["user"],
  ["user-roles"],
] as const;

/**
 * Dry run a bulk role delta. Read-only, so it invalidates nothing.
 *
 * Neither hook here toasts: the caller owns the messaging, because the same failure
 * reads differently depending on which step the operator is standing on.
 */
export const usePreviewBulkRoleChange = () =>
  useMutation<IBulkRolePreviewResponse, unknown, IBulkRoleChangePayload>({
    mutationKey: ["user", "bulk-role-preview"],
    mutationFn: (payload) => userService.previewBulkRoleChange(payload),
  });

/** Queue a bulk role delta, then invalidate the user-shaped caches. */
export const useSubmitBulkRoleChange = () => {
  const queryClient = useQueryClient();

  return useMutation<IBulkRoleSubmitResponse, unknown, IBulkRoleChangePayload>({
    mutationKey: ["user", "bulk-role-submit"],
    mutationFn: (payload) => userService.submitBulkRoleChange(payload),
    onSuccess: () => {
      BULK_ROLE_INVALIDATED_QUERY_KEYS.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    },
  });
};
