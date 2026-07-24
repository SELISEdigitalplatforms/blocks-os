import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { languageManagerService } from "./language.manager.service";
import {
  LANGUAGE_ENDPOINTS,
  LANGUAGE_KEY_ENDPOINTS,
  LANGUAGE_MODULE_ENDPOINTS,
} from "@blocks-localization/constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn(() => "https://logic.test"),
}));

const baseKeyRequest = {
  projectKey: "pk",
  pageNumber: 1,
  pageSize: 20,
  searchKey: "",
  moduleIds: [],
  isPartiallyTranslated: false,
  sortProperty: "keyName",
  isDescending: false,
};

describe("LanguageManagerService", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.clearAllMocks());

  describe("fetchBlocksLanguageKey", () => {
    it("drops date-range fields that are absent", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });
      await languageManagerService.fetchBlocksLanguageKey({ ...baseKeyRequest });
      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload).not.toHaveProperty("createDateRange");
      expect(payload).not.toHaveProperty("lastUpdateDateRange");
    });

    it("keeps provided date ranges", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });
      await languageManagerService.fetchBlocksLanguageKey({
        ...baseKeyRequest,
        createDateRange: { startDate: "2026-01-01", endDate: "2026-02-01" },
      });
      const [url, payload] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe(LANGUAGE_KEY_ENDPOINTS.GETS);
      expect(payload).toHaveProperty("createDateRange");
    });
  });

  it("fetchBlocksLanguageKeyById builds a query with projectKey and itemId", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.fetchBlocksLanguageKeyById({
      projectKey: "pk",
      itemId: "k-1",
    });
    expect(http.get).toHaveBeenCalledWith(
      `${LANGUAGE_KEY_ENDPOINTS.GET}?projectKey=pk&itemId=k-1`,
    );
  });

  it("fetchBlocksLanguageModules queries by projectKey", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await languageManagerService.fetchBlocksLanguageModules("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${LANGUAGE_MODULE_ENDPOINTS.GETS}?projectKey=pk`,
    );
  });

  it("fetchBlocksLanguages queries the logic base url with an absolute url", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    await languageManagerService.fetchBlocksLanguages("pk");
    expect(http.get).toHaveBeenCalledWith(
      `https://logic.test${LANGUAGE_ENDPOINTS.GETS}`,
      undefined,
      { absoluteUrl: true },
    );
  });

  it("saveBlocksLanguageKey defaults isNewKey to false", async () => {
    vi.mocked(http.post).mockResolvedValue({} as never);
    await languageManagerService.saveBlocksLanguageKey({
      itemId: "k-1",
      keyName: "key",
      moduleId: "m",
      resources: [],
      routes: [],
      isPartiallyTranslated: false,
      projectKey: "pk",
    });
    const [url, payload] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe(LANGUAGE_KEY_ENDPOINTS.SAVE);
    expect((payload as { isNewKey: boolean }).isNewKey).toBe(false);
  });

  it("deleteLanguageKey issues a DELETE with query params", async () => {
    vi.mocked(http.delete).mockResolvedValue({ isSuccess: true, errors: null });
    const result = await languageManagerService.deleteLanguageKey({
      itemId: "k-1",
      projectKey: "pk",
    });
    expect(http.delete).toHaveBeenCalledWith(
      `${LANGUAGE_KEY_ENDPOINTS.DELETE}?itemId=k-1&projectKey=pk`,
    );
    expect(result.isSuccess).toBe(true);
  });

  it("deleteLanguage issues a DELETE with query params", async () => {
    vi.mocked(http.delete).mockResolvedValue({ isSuccess: true, errors: null });
    await languageManagerService.deleteLanguage({
      languageName: "en",
      projectKey: "pk",
    });
    expect(http.delete).toHaveBeenCalledWith(
      `${LANGUAGE_ENDPOINTS.DELETE}?languageName=en&projectKey=pk`,
    );
  });

  it("getExportHistory appends only the provided filters", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getExportHistory({
      projectKey: "pk",
      pageNumber: 1,
      pageSize: 10,
      filters: { searchText: "hello", startDate: "2026-01-01" },
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("ProjectKey=pk");
    expect(url).toContain("SearchText=hello");
    expect(url).toContain("CreateDateRange.StartDate=2026-01-01");
    expect(url).not.toContain("CreateDateRange.EndDate");
  });

  it("getLocalizationTimeline appends repeated and conditional params", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getLocalizationTimeline({
      projectKey: "pk",
      pageNumber: 1,
      pageSize: 10,
      userId: "u-1",
      logFromValues: ["a", "b"],
      createDateRange: { endDate: "2026-03-01" },
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("UserId=u-1");
    expect(url).toContain("LogFromValues=a");
    expect(url).toContain("LogFromValues=b");
    expect(url).toContain("CreateDateRange.EndDate=2026-03-01");
  });

  it("getTimelineByOperationId includes the operation id", async () => {
    vi.mocked(http.get).mockResolvedValue({} as never);
    await languageManagerService.getTimelineByOperationId({
      operationId: "op-1",
      projectKey: "pk",
      pageNumber: 1,
      pageSize: 10,
    });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("OperationId=op-1");
  });

  describe("simple POST wrappers", () => {
    const post = <T,>(fn: () => Promise<T>, endpoint: string) => async () => {
      vi.mocked(http.post).mockResolvedValue({ isSuccess: true } as never);
      await fn();
      expect(http.post).toHaveBeenCalledWith(endpoint, expect.anything());
    };

    it(
      "saveLanguageModule",
      post(
        () => languageManagerService.saveLanguageModule({ moduleName: "m", projectKey: "pk" }),
        LANGUAGE_MODULE_ENDPOINTS.SAVE,
      ),
    );
    it(
      "saveLanguage",
      post(
        () =>
          languageManagerService.saveLanguage({
            languageName: "English",
            languageCode: "en",
            projectKey: "pk",
          }),
        LANGUAGE_ENDPOINTS.SAVE,
      ),
    );
    it(
      "setDefault",
      post(
        () => languageManagerService.setDefault({ languageName: "en", projectKey: "pk" }),
        LANGUAGE_ENDPOINTS.SET_DEFAULT,
      ),
    );
    it(
      "generateUilmFile",
      post(
        () => languageManagerService.generateUilmFile({ guid: "g", projectKey: "pk" }),
        LANGUAGE_KEY_ENDPOINTS.GENERATE_UILM_FILE,
      ),
    );
    it(
      "translateAll",
      post(
        () =>
          languageManagerService.translateAll({
            projectKey: "pk",
            messageCoRelationId: "c",
            defaultLanguage: "en",
          }),
        LANGUAGE_KEY_ENDPOINTS.TRANSLATE_ALL,
      ),
    );
    it(
      "translateKey",
      post(
        () =>
          languageManagerService.translateKey({
            keyId: "k",
            projectKey: "pk",
            defaultLanguage: "en",
            messageCoRelationId: "c",
          }),
        LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEY,
      ),
    );
    it(
      "revertKeyTimeline",
      post(
        () => languageManagerService.revertKeyTimeline({ itemId: "i", projectKey: "pk" }),
        LANGUAGE_KEY_ENDPOINTS.ROLLBACK,
      ),
    );
  });
});
