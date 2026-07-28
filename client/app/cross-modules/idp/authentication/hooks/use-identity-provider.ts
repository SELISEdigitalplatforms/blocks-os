import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { identityProviderService } from "@blocks-idp/authentication/services/identity-provider.service";
import {
 IdentityProvider,
 UpdateStatusRequest,
} from "@blocks-idp/authentication/models/identity-provider.model";

const QUERY_KEY = ["identity-providers"] as const;

export const useGetIdentityProviders = ({
 projectId,
}: {
 projectId: string;
}) => {
 return useQuery({
  queryKey: [QUERY_KEY, projectId],
  queryFn: () => identityProviderService.getAll(),
  enabled: !!projectId,
 });
};

export const useGetIdentityProviderById = (
 id: string,
 enabled: boolean = true,
) => {
 return useQuery({
  queryKey: [...QUERY_KEY, id],
  queryFn: () => identityProviderService.getById(id),
  enabled: enabled && !!id,
 });
};

export const useCreateIdentityProvider = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: [...QUERY_KEY, "create"],
  mutationFn: (provider: IdentityProvider) =>
   identityProviderService.create(provider),
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  },
 });
};

export const useUpdateIdentityProvider = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: [...QUERY_KEY, "update"],
  mutationFn: ({ id, provider }: { id: string; provider: IdentityProvider }) =>
   identityProviderService.update(id, provider),
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  },
 });
};

export const useUpdateIdentityProviderStatus = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: [...QUERY_KEY, "update-status"],
  mutationFn: ({ id, request }: { id: string; request: UpdateStatusRequest }) =>
   identityProviderService.updateStatus(id, request),
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  },
 });
};

export const useDeleteIdentityProvider = () => {
 const queryClient = useQueryClient();
 return useMutation({
  mutationKey: [...QUERY_KEY, "delete"],
  mutationFn: (id: string) => identityProviderService.delete(id),
  onSuccess: () => {
   queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  },
 });
};
