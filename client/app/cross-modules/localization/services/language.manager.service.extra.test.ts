import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { languageManagerService } from "./language.manager.service";
import {
  LANGUAGE_KEY_ENDPOINTS,
  LANGUAGE_MODULE_ENDPOINTS,
} from "@blocks-localization/constants/endpoint.constant";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

const baseKeyRequest = {
  projectKey: "pk",
  pageNumber: 1,
  pageSize: 20,
  searchKey: "",
  moduleIds: [] as string[],
  isPartiallyTranslated: false,
  sortProperty: "keyName",
  isDescending: false,
};

describe("LanguageManagerService (extra)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  describe("fetchBlocksLanguageKey date-range trimming", () => {
    it("drops an empty createDateRange.startDate but keeps endDate", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });
      await languageManagerService.fetchBlocksLanguageKey({
        ...baseKeyRequest,
        createDateRange: { startDate: "", endDate: "2026-02-01" },
      });
      const [, payload] = vi.mocked(http.post).mock.calls[0];
      const range = (payload as { createDateRange: Record<string, string> }).createDateRange;
      expect(range).not.toHaveProperty("startDate");
      expect(range.endDate).toBe("2026-02-01");
    });

    it("drops an empty lastUpdateDateRange.endDate but keeps startDate", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });
      await languageManagerService.fetchBlocksLanguageKey({
        ...baseKeyRequest,
        lastUpdateDateRange: { startDate: "2026-01-01", endDate: "" },
      });
      const [, payload] = vi.mocked(http.post).mock.calls[0];
      const range = (payload as { lastUpdateDateRange: Record<string, string> }).lastUpdateDateRange;
      expect(range).not.toHaveProperty("endDate");
      expect(range.startDate).toBe("2026-01-01");
    });
  });

  it("getLanguageModule queries with a capitalized ProjectKey", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await languageManagerService.getLanguageModule("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${LANGUAGE_MODULE_ENDPOINTS.GETS}?ProjectKey=pk`,
    );
  });

  it("getKeysTimeline builds a paged query with the entity id", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getKeysTimeline({
      pageNumber: 2,
      pageSize: 5,
      keyId: "k-1",
      projectKey: "pk",
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain(LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE);
    expect(url).toContain("pageSize=5");
    expect(url).toContain("pageNumber=2");
    expect(url).toContain("projectKey=pk");
    expect(url).toContain("EntityId=k-1");
  });

  it("importLanguageFile POSTs to the UILM import endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { file: "data" } as never;
    await languageManagerService.importLanguageFile(payload);
    expect(http.post).toHaveBeenCalledWith(LANGUAGE_KEY_ENDPOINTS.UILM_IMPORT, payload);
  });

  it("saveLanguageKeyUilmExport POSTs to the UILM export endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    const payload = { keys: [] } as never;
    await languageManagerService.saveLanguageKeyUilmExport(payload);
    expect(http.post).toHaveBeenCalledWith(LANGUAGE_KEY_ENDPOINTS.UILM_EXPORT, payload);
  });

  it("getExportHistory appends only endDate when it is the sole filter", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getExportHistory({
      projectKey: "pk",
      pageNumber: 1,
      pageSize: 10,
      filters: { endDate: "2026-05-05" } as never,
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("CreateDateRange.EndDate=2026-05-05");
    expect(url).not.toContain("SearchText");
    expect(url).not.toContain("CreateDateRange.StartDate");
  });

  it("getExportHistory omits all optional filters when none are given", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getExportHistory({
      projectKey: "pk",
      pageNumber: 1,
      pageSize: 10,
      filters: {} as never,
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("ProjectKey=pk");
    expect(url).not.toContain("SearchText");
    expect(url).not.toContain("CreateDateRange");
  });

  it("getLocalizationTimeline appends logFrom, excluded values and start date", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getLocalizationTimeline({
      projectKey: "pk",
      pageNumber: 1,
      pageSize: 10,
      logFrom: "api",
      excludeLogFromValues: ["x", "y"],
      createDateRange: { startDate: "2026-01-01" },
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("LogFrom=api");
    expect(url).toContain("ExcludeLogFromValues=x");
    expect(url).toContain("ExcludeLogFromValues=y");
    expect(url).toContain("CreateDateRange.StartDate=2026-01-01");
  });
});
