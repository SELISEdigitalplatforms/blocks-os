import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { dataGatewayService } from "../services/data-gateway.service";

// There is at most one configuration, resolved from whichever tenant is ambient on the request -
// the query itself takes no project key. `tenantId` is included only in the query key, purely so
// switching the selected project busts the cache instead of serving the previous project's data.
export const useGetDataGatewayConfiguration = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["data-gateway", "configuration", "get", tenantId],
    queryFn: () => dataGatewayService.configuration.get(),
  });
};

export const useSaveDataGatewayConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["data-gateway", "configuration", "save"],
    mutationFn: dataGatewayService.configuration.save,
    onSuccess: (data) => {
      if (data.isSuccess)
        queryClient.invalidateQueries({ queryKey: ["data-gateway", "configuration", "get"] });
    },
  });
};
