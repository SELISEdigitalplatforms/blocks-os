import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { agentService } from "@blocks-ai/services/agent.service";
import { useLMTQueryAgentSSE } from "./use-agent";

vi.mock("@blocks-ai/services/agent.service", () => ({
  agentService: {
    lmtQuerySSE: vi.fn(),
  },
}));

describe("useLMTQueryAgentSSE", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  it("exposes a streamQuery bound to agentService.lmtQuerySSE", async () => {
    const stream = {} as ReadableStream<Uint8Array>;
    vi.mocked(agentService.lmtQuerySSE).mockResolvedValue(stream);

    const { result } = renderHook(() => useLMTQueryAgentSSE(), {
      wrapper: createWrapper(),
    });

    const payload = { query: "hello" } as never;
    const out = await result.current.streamQuery(payload);

    expect(agentService.lmtQuerySSE).toHaveBeenCalledWith(payload);
    expect(out).toBe(stream);
  });

  it("returns a stable streamQuery function reference", () => {
    const { result } = renderHook(() => useLMTQueryAgentSSE(), {
      wrapper: createWrapper(),
    });
    expect(typeof result.current.streamQuery).toBe("function");
  });
});
