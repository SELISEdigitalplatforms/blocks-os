import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { agentService } from "./agent.service";
import { AI_ENDPOINTS } from "@blocks-ai/constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn(() => "https://agents.test"),
}));

describe("agentService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("lmtQuerySSE streams to the LMT agent endpoint with SSE headers", async () => {
    const stream = {} as ReadableStream<Uint8Array>;
    vi.mocked(http.stream).mockResolvedValue(stream);
    const payload = { query: "how many logs?" } as never;

    const result = await agentService.lmtQuerySSE(payload);

    expect(getRuntimeEnv).toHaveBeenCalledWith("BLOCKS_AGENTS_BASE_URL");
    expect(http.stream).toHaveBeenCalledWith(
      `https://agents.test/api${AI_ENDPOINTS.AGENT_QUERY_LMT_STREAM}`,
      payload,
      { Accept: "text/event-stream" },
      { absoluteUrl: true },
    );
    expect(result).toBe(stream);
  });

  it("propagates errors from the stream layer", async () => {
    vi.mocked(http.stream).mockRejectedValue(new Error("stream failed"));
    await expect(agentService.lmtQuerySSE({} as never)).rejects.toThrow("stream failed");
  });
});
