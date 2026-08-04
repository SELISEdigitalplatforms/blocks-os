import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { serviceRegistryService } from "@blocks-identifier/services/service-registry.service";
import {
  IGetAllServicesPayload,
  IRegisterServicePayload,
} from "@blocks-identifier/types/services.type";

export const useRegisterService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["service", "register"],
    mutationFn: (payload: IRegisterServicePayload) =>
      serviceRegistryService.registerService(payload),
    onSuccess: (res) => {
      if (res.isSuccess) queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });
};

// Service/GetAll resolves the tenant from the impersonated request token, not from a
// payload field or the X-Blocks-Key header, so the same URL and body return different
// data per project. The active tenant must be part of the query key, otherwise
// switching projects serves the previous project's cache until a reload.
export const useGetAllServices = (options: IGetAllServicesPayload) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["services", tenantId, options.page, options.pageSize, options.sort, options.filter],
    queryFn: () => serviceRegistryService.getAllServices(options),
    enabled: !!tenantId,
  });
};
