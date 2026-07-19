import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { ModelService } from "./aimodel.service";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

const ABS = { absoluteUrl: true };

describe("ModelService", () => {
  let service: ModelService;

  beforeEach(() => {
    service = new ModelService();
    vi.clearAllMocks();
    // Empty agents base keeps URLs relative for readable assertions.
    (window as BlocksWindow).__BLOCKS_ENV__ = { BLOCKS_AGENTS_BASE_URL: "" };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as BlocksWindow).__BLOCKS_ENV__;
  });

  it("createModel POSTs to the models endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { provider: "openai" } as never;
    await service.createModel(payload);
    expect(http.post).toHaveBeenCalledWith("/api/models/", payload, undefined, ABS);
  });

  it("getModels builds a query string with all list params", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getModels(
      { provider: "openai", page: 1, page_size: 20 } as never,
      "pk-1",
    );
    expect(http.get).toHaveBeenCalledWith(
      "/api/models/?provider=openai&search=&page=1&page_size=20&project_key=pk-1",
      undefined,
      ABS,
    );
  });

  it("getAllModels only appends provided filters", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getAllModels(
      { provider: "azure", is_active: true } as never,
      "pk-2",
    );
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("provider=azure");
    expect(url).toContain("is_active=true");
    expect(url).toContain("project_key=pk-2");
    expect(url).not.toContain("search=");
  });

  it("getModelById injects the model id and project key", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await service.getModelById("m-1", "pk");
    expect(http.get).toHaveBeenCalledWith(
      "/api/models/m-1?project_key=pk",
      undefined,
      ABS,
    );
  });

  it("deleteModel uses http.delete with the model id", async () => {
    vi.mocked(http.delete).mockResolvedValue({} as never);
    await service.deleteModel("m-1", "pk");
    expect(http.delete).toHaveBeenCalledWith(
      "/api/models/m-1?project_key=pk",
      undefined,
      ABS,
    );
  });

  it("validateModel POSTs an empty body to the validate endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    await service.validateModel("m-1", "pk");
    expect(http.post).toHaveBeenCalledWith(
      "/api/models/m-1/validate?project_key=pk",
      "",
      undefined,
      ABS,
    );
  });

  it("getSeedProviders GETs the seed providers endpoint", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await service.getSeedProviders();
    expect(http.get).toHaveBeenCalledWith(
      "/api/models/seed/providers",
      undefined,
      ABS,
    );
  });

  it("getSeedModelsByProvider injects the provider", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await service.getSeedModelsByProvider("openai");
    expect(http.get).toHaveBeenCalledWith(
      "/api/models/seed/providers/openai",
      undefined,
      ABS,
    );
  });

  it("propagates errors", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("down"));
    await expect(service.getSeedProviders()).rejects.toThrow("down");
  });
});
