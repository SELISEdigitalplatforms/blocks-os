import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiCreditsService } from "../services/ai-credits.service";
import { IRedeemCouponPayload } from "../models/ai-credits.model";

// The tenant is ambient on the request (the impersonated environment), and the app's QueryClient
// already partitions the cache per tenant, so the key carries no project id.
export const AI_CREDITS_USAGE_KEY = ["ai-credits", "usage"] as const;

export const useGetAiCreditsUsage = () =>
  useQuery({
    queryKey: AI_CREDITS_USAGE_KEY,
    queryFn: () => aiCreditsService.getUsage(),
  });

export const useRedeemCoupon = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-credits", "redeem"],
    mutationFn: (payload: IRedeemCouponPayload) => aiCreditsService.redeemCoupon(payload),
    onSettled: () => queryClient.invalidateQueries({ queryKey: AI_CREDITS_USAGE_KEY }),
  });
};
