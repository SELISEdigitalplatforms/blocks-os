import { streamWithAuthRetry } from "@/lib/http/stream-with-auth-retry";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { AI_ENDPOINTS } from "@blocks-ai/constants/endpoint.constant";
import { ILMTQueryAgentPayload } from "@blocks-ai/types/agent.service.type";

class AgentService {
  async lmtQuerySSE(payload: ILMTQueryAgentPayload): Promise<ReadableStream<Uint8Array>> {
    const baseUrl = getRuntimeEnv("BLOCKS_AGENTS_BASE_URL");
    return streamWithAuthRetry(`${baseUrl}/api${AI_ENDPOINTS.AGENT_QUERY_LMT_STREAM}`, payload, {
      Accept: "text/event-stream",
    }, { absoluteUrl: true });
  }
}

export const agentService = new AgentService();
