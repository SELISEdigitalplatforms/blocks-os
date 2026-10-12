import { http } from "@/lib/http/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { AI_CREDITS_ENDPOINTS } from "../constants/endpoint.constant";
import {
  IAgentCreditsUsage,
  ICreateTopUpPayload,
  ICreateTopUpResponse,
} from "../models/ai-credits.model";

const agentsBase = () => getRuntimeEnv("BLOCKS_AGENTS_BASE_URL");

export class AiCreditsService {
  getUsage(): Promise<IAgentCreditsUsage> {
    return http.get(`${agentsBase()}${AI_CREDITS_ENDPOINTS.USAGE_CURRENT}`, undefined, {
      absoluteUrl: true,
    });
  }

  createTopUp(payload: ICreateTopUpPayload): Promise<ICreateTopUpResponse> {
    return http.post(`${agentsBase()}${AI_CREDITS_ENDPOINTS.TOP_UPS}`, payload, undefined, {
      absoluteUrl: true,
    });
  }
}

export const aiCreditsService = new AiCreditsService();
