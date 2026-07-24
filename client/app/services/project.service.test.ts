import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { ProjectService } from "./project.service";
import { PROJECT_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import { getRuntimeEnv } from "@/lib/runtime-env";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const ABS = { absoluteUrl: true };
const BASE = getRuntimeEnv("BLOCKS_OS_BASE_URL");

describe("ProjectService", () => {
  let service: ProjectService;

  beforeEach(() => {
    service = new ProjectService();
    vi.clearAllMocks();
  });

  afterEach(() => vi.clearAllMocks());

  it("getProjects builds a paged, tenant-scoped url and returns the data", async () => {
    const groups = [{ projects: [{ itemId: "a" }] }];
    vi.mocked(http.get).mockResolvedValue(groups);

    const result = await service.getProjects(1, 50, "tg-1");

    expect(http.get).toHaveBeenCalledWith(
      `${BASE}${PROJECT_ENDPOINTS.GETS}?page=1&pageSize=50&tenantGroupId=tg-1`,
      undefined,
      ABS,
    );
    expect(result).toBe(groups);
  });

  it("getProjects applies default paging arguments", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await service.getProjects();
    expect(http.get).toHaveBeenCalledWith(
      `${BASE}${PROJECT_ENDPOINTS.GETS}?page=0&pageSize=100&tenantGroupId=`,
      undefined,
      ABS,
    );
  });

  it("getProject requests the current project", async () => {
    const project = { itemId: "p-1" };
    vi.mocked(http.get).mockResolvedValue(project);

    const result = await service.getProject();

    expect(http.get).toHaveBeenCalledWith(
      `${BASE}${PROJECT_ENDPOINTS.GET}`,
      undefined,
      ABS,
    );
    expect(result).toBe(project);
  });

  it("propagates errors from the http layer", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("boom"));
    await expect(service.getProjects()).rejects.toThrow("boom");
  });
});
