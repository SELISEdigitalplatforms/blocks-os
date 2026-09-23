import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataGatewayService } from "../services/data-gateway.service";
import { IGetDataGatewayConfigurationPayload } from "../models/data-gateway.model";

// Storage's `gets()` deliberately isn't scoped by the active project because it only ever holds a
// handful of shared, named configurations. DataGateway configurations are the opposite: they are
// genuinely one-per-project, and this list is an admin view meant to browse every project's
// configuration, not just the currently selected tenant's - so the query key is intentionally not
// keyed on the selected project either.
export const useGetDataGatewayConfigurations = () => {
  return useQuery({
    queryKey: ["data-gateway", "configuration", "gets"],
    queryFn: () => dataGatewayService.configuration.gets(),
  });
};

export const useGetDataGatewayConfiguration = (
  payload: IGetDataGatewayConfigurationPayload,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["data-gateway", "configuration", "get", payload.projectKey],
    queryFn: () => dataGatewayService.configuration.get(payload.projectKey),
    enabled: options?.enabled ?? !!payload.projectKey,
  });
};

export const useSaveDataGatewayConfiguration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["data-gateway", "configuration", "save"],
    mutationFn: dataGatewayService.configuration.save,
    onSuccess: (data) => {
      if (data.isSuccess)
        queryClient.invalidateQueries({ queryKey: ["data-gateway", "configuration", "gets"] });
    },
  });
};
