import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { useDomainSetupGuide, useDomainSetupStream } from "./use-domain-setup";

vi.mock("@seliseblocks/genesis-os", () => ({
  useImpersonateStore: vi.fn(() => ({
    isInitialized: true,
    isImpersonated: false,
    impersonatedTenantId: "",
    originalTenantId: "tenant-1",
  })),
}));

vi.mock("@blocks-identifier/services/project.service", () => ({
  projectService: {
    getDomainSetupGuide: vi.fn(),
    configureDomainStream: vi.fn(),
  },
}));

// Emits each chunk as its own read, the way a proxy may split events.
const sseStream = (...chunks: string[]) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
};

const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

describe("useDomainSetupGuide", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the guide for the current tenant", async () => {
    vi.mocked(crossProjectService.getDomainSetupGuide).mockResolvedValue({
      isSuccess: true,
      errors: null,
      applications: [],
    });

    const { result } = renderHook(() => useDomainSetupGuide(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(crossProjectService.getDomainSetupGuide).toHaveBeenCalledTimes(1);
  });
});

describe("useDomainSetupStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("follows each step and succeeds on a successful result", async () => {
    vi.mocked(crossProjectService.configureDomainStream).mockResolvedValue(
      sseStream(
        event("step", { step: "app_dns", status: "running", host: "app.example.com" }),
        event("step", { step: "app_dns", status: "done", host: "app.example.com" }),
        ": heartbeat\n\n",
        // An event split across two reads
        event("step", { step: "api_dns", status: "done" }).slice(0, 12),
        event("step", { step: "api_dns", status: "done" }).slice(12),
        event("step", { step: "ssl", status: "done" }),
        event("result", { isSuccess: true, errors: null }),
      ),
    );

    const { result } = renderHook(() => useDomainSetupStream(), { wrapper: createWrapper() });

    await act(() => result.current.start("app.example.com"));

    expect(crossProjectService.configureDomainStream).toHaveBeenCalledWith(
      { cookieDomain: "app.example.com" },
      expect.any(AbortSignal),
    );
    expect(result.current.phase).toBe("succeeded");
    expect(result.current.steps.app_dns.status).toBe("done");
    expect(result.current.steps.api_dns.status).toBe("done");
    expect(result.current.steps.ssl.status).toBe("done");
    expect(result.current.error).toBeNull();
  });

  it("fails with the step message and the result error", async () => {
    vi.mocked(crossProjectService.configureDomainStream).mockResolvedValue(
      sseStream(
        event("step", { step: "app_dns", status: "done" }),
        event("step", {
          step: "api_dns",
          status: "failed",
          message: "No DNS record found for dev-blocksapi.example.com.",
        }),
        event("result", {
          isSuccess: false,
          errors: {
            domain_verification_failed: "No DNS record found for dev-blocksapi.example.com.",
          },
        }),
      ),
    );

    const { result } = renderHook(() => useDomainSetupStream(), { wrapper: createWrapper() });

    await act(() => result.current.start("app.example.com"));

    expect(result.current.phase).toBe("failed");
    expect(result.current.steps.api_dns).toEqual({
      status: "failed",
      message: "No DNS record found for dev-blocksapi.example.com.",
    });
    expect(result.current.steps.ssl.status).toBe("pending");
    expect(result.current.error).toBe("No DNS record found for dev-blocksapi.example.com.");
  });

  it("reports a lost connection when the stream ends without a result", async () => {
    vi.mocked(crossProjectService.configureDomainStream).mockResolvedValue(
      sseStream(event("step", { step: "app_dns", status: "running" })),
    );

    const { result } = renderHook(() => useDomainSetupStream(), { wrapper: createWrapper() });

    await act(() => result.current.start("app.example.com"));

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toMatch(/lost the connection/);
  });

  it("reports a lost connection when the request itself fails", async () => {
    vi.mocked(crossProjectService.configureDomainStream).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useDomainSetupStream(), { wrapper: createWrapper() });

    await act(() => result.current.start("app.example.com"));

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toMatch(/lost the connection/);
  });

  it("returns to idle on reset", async () => {
    vi.mocked(crossProjectService.configureDomainStream).mockResolvedValue(
      sseStream(event("result", { isSuccess: false, errors: { x: "nope" } })),
    );

    const { result } = renderHook(() => useDomainSetupStream(), { wrapper: createWrapper() });

    await act(() => result.current.start("app.example.com"));
    act(() => result.current.reset());

    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeNull();
  });
});
