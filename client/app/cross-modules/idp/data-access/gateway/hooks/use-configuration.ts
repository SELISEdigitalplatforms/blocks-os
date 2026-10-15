import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { platformDataAccessService } from "../../data-access.service";
import type { IDeletePolicyPayload } from "../models/data-service";

export const useGetPolicyData = ({ entityName, projectKey, schemaId, enabled = true }: { entityName: string; projectKey: string; schemaId?: string; enabled?: boolean }) =>
  useQuery({ queryKey: ["platform-data-access-policies", schemaId, entityName, projectKey], queryFn: () => platformDataAccessService.getPolicies(schemaId ?? ""), enabled: enabled && !!schemaId });

const refreshAccessData = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({ queryKey: ["platform-data-access-policies"] });
  void client.invalidateQueries({ queryKey: ["platform-data-access-schemas"] });
};

export const useSetRowColumnPermission = (_schemaId?: string) => {
  const client = useQueryClient();
  return useMutation({ mutationFn: platformDataAccessService.configure, onSuccess: () => refreshAccessData(client) });
};

export const useCreatePolicy = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: platformDataAccessService.create, onSuccess: () => refreshAccessData(client) });
};

export const useUpdatePolicy = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: platformDataAccessService.update, onSuccess: () => refreshAccessData(client) });
};

export const useDeletePolicy = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: (payload: IDeletePolicyPayload) => platformDataAccessService.delete(payload.itemId), onSuccess: () => client.invalidateQueries({ queryKey: ["platform-data-access-policies"] }) });
};
