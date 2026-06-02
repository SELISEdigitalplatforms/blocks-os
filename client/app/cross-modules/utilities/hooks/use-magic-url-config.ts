import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { magicUrlConfigService } from "@blocks-utilities/services/magic-url-config.service";
import {
  IGetMagicUrlConfigsPayload,
  ISaveMagicUrlConfigPayload,
} from "@blocks-utilities/models/magic-url-config.model";

export const magicUrlConfigsQueryKey = (options: IGetMagicUrlConfigsPayload) => [
  "magic-url-configs",
  options.projectKey,
  options.page,
  options.pageSize,
  options.searchText ?? "",
] as const;

export const useGetMagicUrlConfigs = (
  options: IGetMagicUrlConfigsPayload,
  queryOptions?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: magicUrlConfigsQueryKey(options),
    queryFn: () => magicUrlConfigService.getMagicUrlConfigs(options),
    enabled: !!options.projectKey && (queryOptions?.enabled ?? true),
  });
};

export const useSaveMagicUrlConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["magic-url-config", "save"],
    mutationFn: (payload: ISaveMagicUrlConfigPayload) =>
      magicUrlConfigService.saveMagicUrlConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["magic-url-configs"] });
    },
  });
};

export const useDeleteMagicUrlConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["magic-url-config", "delete"],
    mutationFn: (itemId: string) => magicUrlConfigService.deleteMagicUrlConfig(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["magic-url-configs"] });
    },
  });
};
