import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { SecretsService, SECRETS_ENDPOINTS } from "./secrets.service";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("SecretsService", () => {
  let service: SecretsService;

  beforeEach(() => {
    service = new SecretsService();
    vi.clearAllMocks();
  });
  afterEach(() => vi.clearAllMocks());

  it("save POSTs to the Save endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({ itemId: "s-1" });
    const payload = { secretKey: "captcha", keyValuePairs: {} };
    const result = await service.save(payload);
    expect(http.post).toHaveBeenCalledWith(SECRETS_ENDPOINTS.SAVE, payload);
    expect(result).toEqual({ itemId: "s-1" });
  });

  it("gets returns the array directly when the response is an array", async () => {
    vi.mocked(http.get).mockResolvedValue([{ itemId: "s-1" }]);
    const result = await service.gets("captcha");
    expect(http.get).toHaveBeenCalledWith(
      `${SECRETS_ENDPOINTS.GETS}?secretKey=captcha&PageNumber=0&PageSize=10`,
    );
    expect(result).toEqual([{ itemId: "s-1" }]);
  });

  it("gets unwraps a wrapped API response", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [{ itemId: "s-2" }] });
    const result = await service.gets("magic-url");
    expect(result).toEqual([{ itemId: "s-2" }]);
  });

  it("gets returns an empty array when data is missing", async () => {
    vi.mocked(http.get).mockResolvedValue({});
    const result = await service.gets("captcha");
    expect(result).toEqual([]);
  });

  it("get fetches a secret by item id", async () => {
    vi.mocked(http.get).mockResolvedValue({ itemId: "s-1" });
    await service.get("s-1");
    expect(http.get).toHaveBeenCalledWith(`${SECRETS_ENDPOINTS.GET}?ItemId=s-1`);
  });

  it("delete POSTs the item id", async () => {
    vi.mocked(http.post).mockResolvedValue(undefined);
    await service.delete("s-1");
    expect(http.post).toHaveBeenCalledWith(SECRETS_ENDPOINTS.DELETE, { itemId: "s-1" });
  });
});
