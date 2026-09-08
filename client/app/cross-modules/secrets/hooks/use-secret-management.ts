import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { secretManagementService } from "@/cross-modules/secrets/services/secret-management.service";
import {
  looksLikeSecretId,
  secretTags,
  type SecretAccess,
  type SecretAuditFilter,
  type SecretAuditListResult,
  type SecretFilter,
  type SecretListResult,
  type SecretResult,
  type SecretTagEntry,
  type SetSecretRequest,
  type UpdateSecretRequest,
} from "@/cross-modules/secrets/models/secret.model";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";

/**
 * The secret endpoints resolve the tenant from the request token, so the same URL returns
 * different data per project. The active tenant has to be part of every query key, otherwise
 * switching projects serves the previous project's cache.
 */
const useTenantId = (): string => useProjectStore().selectedProject?.tenantId || "";

export const secretQueryKeys = {
  list: (tenantId: string, filter?: unknown) =>
    filter === undefined
      ? (["secrets", "list", tenantId] as const)
      : (["secrets", "list", tenantId, filter] as const),
  item: (tenantId: string, secretId: string) => ["secrets", "item", tenantId, secretId] as const,
  tags: (tenantId: string) => ["secrets", "tags", tenantId] as const,
  audit: (tenantId: string, secretId: string, filter?: unknown) =>
    ["secrets", "audit", tenantId, secretId, filter] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Paged secret list.
 *
 * When `search` looks like a secret id the list endpoint is bypassed: `SecretFilter.Search`
 * matches name and description only, so a pasted id would always return nothing. The single
 * fetched row is still checked against the type/status filters, so the toolbar never claims to
 * be filtering while showing a row that contradicts it, and an unknown id renders as an empty
 * list rather than an error.
 */
export const useFindSecrets = (filter: SecretFilter = {}, enabled = true) => {
  const tenantId = useTenantId();
  const search = filter.search?.trim() ?? "";
  const byId = looksLikeSecretId(search);

  return useQuery<SecretListResult>({
    queryKey: secretQueryKeys.list(tenantId, filter),
    queryFn: async () => {
      if (!byId) return secretManagementService.find(filter);

      try {
        const secret = await secretManagementService.get(search);
        const matchesType = !filter.type || secret.type === filter.type;
        const matchesStatus = !filter.status || secret.status === filter.status;
        // Any-of, matching the server: the row survives if it carries at least one selected tag.
        const matchesTags =
          !filter.tags?.length || filter.tags.some((tag) => secretTags(secret).includes(tag));
        return matchesType && matchesStatus && matchesTags
          ? { data: [secret], totalCount: 1 }
          : { data: [], totalCount: 0 };
      } catch (error) {
        // An id that matches nothing is an empty result, not a failure.
        if (isHttpErrorStatus(error, 404)) return { data: [], totalCount: 0 };
        throw error;
      }
    },
    enabled: enabled && !!tenantId,
  });
};

export const useGetSecret = (secretId: string, enabled = true) => {
  const tenantId = useTenantId();
  return useQuery<SecretResult>({
    queryKey: secretQueryKeys.item(tenantId, secretId),
    queryFn: () => secretManagementService.get(secretId),
    enabled: enabled && !!secretId && !!tenantId,
  });
};

/**
 * The tenant tag catalogue, for the tag picker and the tag filter.
 *
 * Long-lived in cache: it is a small list of labels that changes only when someone introduces
 * a tag, and the mutations that can do that invalidate it themselves.
 */
export const useSecretTags = (enabled = true) => {
  const tenantId = useTenantId();
  return useQuery<SecretTagEntry[]>({
    queryKey: secretQueryKeys.tags(tenantId),
    queryFn: () => secretManagementService.getTags(),
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSecretAuditLogs = (filter: SecretAuditFilter, enabled = true) => {
  const tenantId = useTenantId();
  return useQuery<SecretAuditListResult>({
    queryKey: secretQueryKeys.audit(tenantId, filter.secretId ?? "", filter),
    queryFn: () => secretManagementService.getAuditLogs(filter),
    enabled: enabled && !!filter.secretId && !!tenantId,
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Shared invalidation + toast wiring, so every mutation behaves the same on failure. */
const useSecretMutationHelpers = () => {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return {
    tenantId,
    invalidateList: () =>
      queryClient.invalidateQueries({ queryKey: secretQueryKeys.list(tenantId) }),
    invalidateItem: (secretId: string) =>
      queryClient.invalidateQueries({ queryKey: secretQueryKeys.item(tenantId, secretId) }),
    // A write can introduce a tag the catalogue has not seen, and the server adds it there.
    invalidateTags: () =>
      queryClient.invalidateQueries({ queryKey: secretQueryKeys.tags(tenantId) }),
    toastError: (error: unknown, fallback?: string) =>
      showErrorToast({ errors: describeSecretError(error, fallback).message }),
  };
};

/**
 * Reads a plaintext value.
 *
 * A mutation, never a query: `useQuery` would put the plaintext in the React Query cache, keep
 * it there for the cache lifetime, and refetch it on window focus — each refetch writing a
 * `GetValue` row into the audit log that no user asked for.
 */
export const useRevealSecret = () => {
  const { toastError } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: (secretId: string) => secretManagementService.getValue(secretId),
    // No cache write and no toast on success — the caller renders the value and drops it.
    onError: (error) => toastError(error, "Could not read the secret value."),
    gcTime: 0,
  });
};

export const useSetSecret = () => {
  const { invalidateList, invalidateTags } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: (payload: SetSecretRequest) => secretManagementService.set(payload),
    onSuccess: () => {
      invalidateList();
      invalidateTags();
      showSuccessToast({ description: "Secret created." });
    },
    // Errors surface as inline field messages in the form (NAME_INVALID maps onto the name
    // input), so no toast here — it would duplicate the field error.
  });
};

export const useUpdateSecret = () => {
  const { invalidateList, invalidateItem, invalidateTags } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: ({ secretId, ...payload }: UpdateSecretRequest & { secretId: string }) =>
      secretManagementService.update(secretId, payload),
    onSuccess: (_, variables) => {
      invalidateList();
      invalidateItem(variables.secretId);
      if (variables.tags) invalidateTags();
    },
  });
};

export const useUpdateSecretAccess = () => {
  const { invalidateList, invalidateItem } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: ({ secretId, access }: { secretId: string; access: SecretAccess }) =>
      secretManagementService.updateAccess(secretId, access),
    onSuccess: (_, variables) => {
      invalidateList();
      invalidateItem(variables.secretId);
    },
  });
};

export const useRotateSecret = () => {
  const { invalidateList, invalidateItem, toastError } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: ({ secretId, value }: { secretId: string; value: string }) =>
      secretManagementService.rotate(secretId, value),
    onSuccess: (_, variables) => {
      invalidateList();
      invalidateItem(variables.secretId);
      showSuccessToast({ description: "Secret rotated." });
    },
    onError: (error) => toastError(error, "Could not rotate the secret."),
  });
};

export const useLockSecret = () => {
  const { invalidateList, invalidateItem, toastError } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: (secretId: string) => secretManagementService.lock(secretId),
    onSuccess: (_, secretId) => {
      invalidateList();
      invalidateItem(secretId);
      showSuccessToast({ description: "Secret locked." });
    },
    onError: (error) => toastError(error, "Could not lock the secret."),
  });
};

export const useUnlockSecret = () => {
  const { invalidateList, invalidateItem, toastError } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: (secretId: string) => secretManagementService.unlock(secretId),
    onSuccess: (_, secretId) => {
      invalidateList();
      invalidateItem(secretId);
      showSuccessToast({ description: "Secret unlocked." });
    },
    onError: (error) => toastError(error, "Could not unlock the secret."),
  });
};

export const useDeleteSecret = () => {
  const { invalidateList, invalidateItem, toastError } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: (secretId: string) => secretManagementService.remove(secretId),
    onSuccess: (_, secretId) => {
      invalidateList();
      invalidateItem(secretId);
      showSuccessToast({ description: "Secret deleted. It can still be restored." });
    },
    onError: (error) => toastError(error, "Could not delete the secret."),
  });
};

export const useRestoreSecret = () => {
  const { invalidateList, invalidateItem, toastError } = useSecretMutationHelpers();
  return useMutation({
    mutationFn: (secretId: string) => secretManagementService.restore(secretId),
    onSuccess: (_, secretId) => {
      invalidateList();
      invalidateItem(secretId);
      showSuccessToast({ description: "Secret restored." });
    },
    onError: (error) => toastError(error, "Could not restore the secret."),
  });
};
