import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { MagicUrlService } from "./magic-url.service";
import { MAGIC_URL_ENDPOINTS } from "@blocks-utilities/constants/endpoint.constant";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("MagicUrlService", () => {
  let service: MagicUrlService;

  beforeEach(() => {
    service = new MagicUrlService();
    vi.clearAllMocks();
  });
  afterEach(() => vi.clearAllMocks());

  it("getMagicUrl unwraps the API response data", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { itemId: "m-1" } });
    const result = await service.getMagicUrl({ ItemId: "m-1" } as never);
    expect(http.get).toHaveBeenCalledWith(`${MAGIC_URL_ENDPOINTS.GET_LINK}?ItemId=m-1`);
    expect(result).toEqual({ itemId: "m-1" });
  });

  it("getMagicUrls appends only provided filters and normalizes the response", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], errors: null, totalCount: undefined });
    const result = await service.getMagicUrls({
      page: 1,
      pageSize: 10,
      searchText: "abc",
      status: "active",
      requestMethod: "GET",
    } as never);

    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("secretKey=magic-url");
    expect(url).toContain("SearchText=abc");
    expect(url).toContain("Status=active");
    expect(url).toContain("RequestMethod=GET");
    expect(url).not.toContain("ExpiryDateRange");
    expect(result).toEqual({ data: [], errors: [], totalCount: 0 });
  });

  it("getMagicUrls includes expiry date range params when provided", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], errors: [], totalCount: 3 });
    await service.getMagicUrls({
      page: 1,
      pageSize: 10,
      expiryDateRangeStartDate: "2026-01-01",
      expiryDateRangeEndDate: "2026-02-01",
    } as never);
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    expect(url).toContain("ExpiryDateRange.StartDate=2026-01-01");
    expect(url).toContain("ExpiryDateRange.EndDate=2026-02-01");
  });

  it("createMagicUrl POSTs the payload and returns the created link", async () => {
    vi.mocked(http.post).mockResolvedValue({ itemId: "m-2" });
    const result = await service.createMagicUrl({ name: "x" } as never);
    expect(http.post).toHaveBeenCalledWith(MAGIC_URL_ENDPOINTS.CREATE_LINK, { name: "x" });
    expect(result).toEqual({ itemId: "m-2" });
  });

  it("deactivateMagicLinks POSTs the link ids", async () => {
    vi.mocked(http.post).mockResolvedValue(undefined);
    await service.deactivateMagicLinks({ linkIds: ["a"], projectKey: "pk" });
    expect(http.post).toHaveBeenCalledWith(MAGIC_URL_ENDPOINTS.REMOVE_LINKS, {
      linkIds: ["a"],
      projectKey: "pk",
    });
  });
});
