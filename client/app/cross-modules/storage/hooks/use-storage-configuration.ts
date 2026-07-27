import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { storageService } from "../services/storage.service";
import { useProjectStore } from "@seliseblocks/genesis-os";

export const useGetStorageConfigurations = () => {
  return useQuery({
    queryKey: ["storage", "configuration", "gets"],
    queryFn: () => storageService.configuration.gets(),
  });
};

export const useSaveStorageConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "configuration", "save"],
    mutationFn: storageService.configuration.save,
    onSuccess: (data) => {
      if (data.isSuccess)
        queryClient.invalidateQueries({ queryKey: ["storage", "configuration", "gets"] });
    },
  });
};
export const useDeleteStorageConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "configuration", "delete"],
    mutationFn: storageService.configuration.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage", "configuration", "gets"] });
    },
  });
};
