import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { webhooksService } from "../services/webhooks.service";
import type { IDeliveriesQuery, ISaveWebhookPayload } from "../models/webhook.model";

// The tenant is in every key: the endpoints read it from the token, so a project switch must not
// show the previous project's webhooks or history.
const useTenantId = () => useProjectStore().selectedProject?.tenantId || "";

export const useGetWebhooks = () => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["webhooks", "gets", tenantId],
    queryFn: () => webhooksService.gets(),
  });
};

export const useGetWebhook = (id: string) => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["webhooks", "get", tenantId, id],
    queryFn: () => webhooksService.get(id),
    enabled: id.length > 0,
  });
};

export const useSaveWebhook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["webhooks", "save"],
    mutationFn: (payload: ISaveWebhookPayload) => webhooksService.save(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });
};

export const useDeleteWebhook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["webhooks", "delete"],
    mutationFn: (id: string) => webhooksService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });
};

export const useTestWebhook = () =>
  useMutation({
    mutationKey: ["webhooks", "test"],
    mutationFn: (id: string) => webhooksService.test(id),
  });

export const useGetDeliveries = (query: IDeliveriesQuery) => {
  const tenantId = useTenantId();
  return useQuery({
    queryKey: ["webhooks", "deliveries", tenantId, query],
    queryFn: () => webhooksService.deliveries(query),
    enabled: query.webhookId.length > 0,
    placeholderData: keepPreviousData,
  });
};

export const useResendDelivery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["webhooks", "resend"],
    mutationFn: (deliveryId: string) => webhooksService.resend(deliveryId),
    // Success and the 409 "still sending" case both mean the row changed: refresh the history.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["webhooks", "deliveries"] }),
  });
};
