import { http } from "@/lib/http/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { AI_CREDITS_ENDPOINTS } from "../constants/endpoint.constant";
import {
  IAgentCreditsUsage,
  IRedeemCouponPayload,
  IRedeemCouponResponse,
} from "../models/ai-credits.model";

const agentsBase = () => getRuntimeEnv("BLOCKS_AGENTS_BASE_URL");

export class AiCreditsService {
  getUsage(): Promise<IAgentCreditsUsage> {
    return http.get(`${agentsBase()}${AI_CREDITS_ENDPOINTS.USAGE_CURRENT}`, undefined, {
      absoluteUrl: true,
    });
  }

  redeemCoupon(payload: IRedeemCouponPayload): Promise<IRedeemCouponResponse> {
    return http.post(`${agentsBase()}${AI_CREDITS_ENDPOINTS.REDEEM_COUPON}`, payload, undefined, {
      absoluteUrl: true,
    });
  }
}

export const aiCreditsService = new AiCreditsService();
