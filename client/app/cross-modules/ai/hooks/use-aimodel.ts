import { parseAsArrayOf, parseAsString, parseAsInteger, useQueryStates } from "nuqs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { modelService } from "@blocks-ai/services/aimodel.service";
import {
  ICreateModelPayload,
  IModelListPayload,
  IUpdateModelPayload,
} from "@blocks-ai/types/aimodel.service.type";

export const useAIModelsQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    search: parseAsString.withDefault(""),
    types: parseAsArrayOf(parseAsString).withDefault([]),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(10),
  });

  return { queryParams, setQueryParams };
};

export const useCreateModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["model", "create"],
    mutationFn: (payload: ICreateModelPayload) => modelService.createModel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["model"] });
    },
  });
};

// `project_key` is sent as a query parameter, so the same payload returns different
// models per project. It has to be part of the query key, otherwise switching
// projects serves the previous project's cache until a reload. The two list hooks
// also need distinct prefixes: they call different endpoints with the same payload.
export const useGetModels = (payload: IModelListPayload, projectKey: string) => {
  return useQuery({
    queryKey: ["models", "list", projectKey, payload],
    queryFn: () => modelService.getModels(payload, projectKey),
  });
};

export const useGetAllModels = (payload: IModelListPayload, projectKey: string) => {
  return useQuery({
    queryKey: ["models", "all", projectKey, payload],
    queryFn: () => modelService.getAllModels(payload, projectKey),
  });
};

export const useGetModelById = (modelId: string, projectKey: string) => {
  return useQuery({
    queryKey: ["model", projectKey, modelId],
    queryFn: () => modelService.getModelById(modelId, projectKey),
    enabled: !!modelId,
  });
};

export const useUpdateModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["model", "update"],
    mutationFn: ({ modelId, payload }: { modelId: string; payload: IUpdateModelPayload }) =>
      modelService.updateModel(modelId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
};

export const useDeleteModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["model", "delete"],
    mutationFn: ({ modelId, project_key: projectKey }: { modelId: string; project_key: string }) =>
      modelService.deleteModel(modelId, projectKey),
    onSuccess: (res) => {
      if (res?.is_success) {
        queryClient.invalidateQueries({ queryKey: ["models"] });
        queryClient.invalidateQueries({ queryKey: ["model"] });
      }
    },
  });
};

export const useValidateModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["model", "validate"],
    mutationFn: ({ modelId, project_key: projectKey }: { modelId: string; project_key: string }) =>
      modelService.validateModel(modelId, projectKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });
};

export const useSeedProviders = () => {
  return useQuery({
    queryKey: ["seed-providers"],
    queryFn: () => modelService.getSeedProviders(),
  });
};

export const useSeedModelsByProvider = (provider: string) => {
  return useQuery({
    queryKey: ["seed-models", provider],
    queryFn: () => modelService.getSeedModelsByProvider(provider),
    enabled: !!provider,
  });
};
