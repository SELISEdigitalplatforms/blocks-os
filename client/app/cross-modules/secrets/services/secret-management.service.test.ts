import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { SECRET_STATUS, SECRET_TYPE } from "@/cross-modules/secrets/models/secret.model";
import { SECRET_ENDPOINTS, SecretManagementService } from "./secret-management.service";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

describe("SecretManagementService", () => {
  let service: SecretManagementService;

  beforeEach(() => {
    service = new SecretManagementService();
    vi.clearAllMocks();
  });

  it("targets the new /api/secrets endpoints", () => {
    expect(SECRET_ENDPOINTS.GETS).toBe("/api/secrets/gets");
    expect(SECRET_ENDPOINTS.VALUE).toBe("/api/secrets/value");
    expect(SECRET_ENDPOINTS.ACCESS).toBe("/api/secrets/access");
    expect(SECRET_ENDPOINTS.TAGS).toBe("/api/secrets/tags");
  });

  describe("tags", () => {
    it("repeats the key once per tag, which is what binds to a collection", async () => {
      // `String(["a", "b"])` would send the single value `a,b` and the backend would look for
      // one tag literally named "a,b".
      vi.mocked(http.get).mockResolvedValue({ data: [], totalCount: 0 });

      await service.find({ tags: ["iam", "os"] });

      const url = vi.mocked(http.get).mock.calls[0][0] as string;
      const params = new URLSearchParams(url.split("?")[1]);
      expect(params.getAll("tags")).toEqual(["iam", "os"]);
    });

    it("omits an empty tag array", async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [], totalCount: 0 });

      await service.find({ tags: [] });

      expect(vi.mocked(http.get).mock.calls[0][0]).toBe(SECRET_ENDPOINTS.GETS);
    });

    it("reads the catalogue from the tags endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue([{ key: "iam", label: "Blocks Iam" }]);

      const tags = await service.getTags();

      expect(vi.mocked(http.get)).toHaveBeenCalledWith(SECRET_ENDPOINTS.TAGS);
      expect(tags).toEqual([{ key: "iam", label: "Blocks Iam" }]);
    });
  });

  describe("find", () => {
    it("sends every provided filter as a query parameter", async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [], totalCount: 0 });

      await service.find({
        search: "gateway",
        type: SECRET_TYPE.Api,
        status: SECRET_STATUS.Locked,
        includeDeleted: true,
        pageNumber: 2,
        pageSize: 20,
      });

      const url = vi.mocked(http.get).mock.calls[0][0] as string;
      expect(url.startsWith(`${SECRET_ENDPOINTS.GETS}?`)).toBe(true);
      const params = new URLSearchParams(url.split("?")[1]);
      expect(params.get("search")).toBe("gateway");
      expect(params.get("type")).toBe("api");
      expect(params.get("status")).toBe("locked");
      expect(params.get("includeDeleted")).toBe("true");
      expect(params.get("pageNumber")).toBe("2");
      expect(params.get("pageSize")).toBe("20");
    });

    it("omits empty filters rather than sending blank values", async () => {
      // `SecretFilter.Type` is nullable server-side; `type=` is not the same as "no filter".
      vi.mocked(http.get).mockResolvedValue({ data: [], totalCount: 0 });

      await service.find({ search: "", type: undefined, pageNumber: 1 });

      expect(http.get).toHaveBeenCalledWith(`${SECRET_ENDPOINTS.GETS}?pageNumber=1`);
    });

    it("sends no query string at all for an empty filter", async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [], totalCount: 0 });
      await service.find();
      expect(http.get).toHaveBeenCalledWith(SECRET_ENDPOINTS.GETS);
    });
  });

  it("get fetches a single secret by id", async () => {
    vi.mocked(http.get).mockResolvedValue({ secretId: "s-1" });
    await service.get("s-1");
    expect(http.get).toHaveBeenCalledWith(`${SECRET_ENDPOINTS.GET}?secretId=s-1`);
  });

  it("getValue reads the plaintext through the audited endpoint", async () => {
    vi.mocked(http.get).mockResolvedValue({ secretId: "s-1", value: "shh" });
    const result = await service.getValue("s-1");
    expect(http.get).toHaveBeenCalledWith(`${SECRET_ENDPOINTS.VALUE}?secretId=s-1`);
    expect(result.value).toBe("shh");
  });

  it("getValues posts the id batch", async () => {
    vi.mocked(http.post).mockResolvedValue({ values: {} });
    await service.getValues(["s-1", "s-2"]);
    expect(http.post).toHaveBeenCalledWith(SECRET_ENDPOINTS.VALUES, {
      secretIds: ["s-1", "s-2"],
    });
  });

  it("set posts the create payload", async () => {
    vi.mocked(http.post).mockResolvedValue({ secretId: "s-1" });
    const payload = {
      name: "n",
      value: "v",
      type: SECRET_TYPE.Service,
      access: null,
    };
    await service.set(payload);
    expect(http.post).toHaveBeenCalledWith(SECRET_ENDPOINTS.SET, payload);
  });

  it("setMany posts an array", async () => {
    vi.mocked(http.post).mockResolvedValue({ secretIds: {} });
    const payloads = [{ name: "a", value: "1", type: SECRET_TYPE.Api }];
    await service.setMany(payloads);
    expect(http.post).toHaveBeenCalledWith(SECRET_ENDPOINTS.SET_MANY, payloads);
  });

  it("update sends metadata only, with the id in the body", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    await service.update("s-1", { name: "renamed", description: "why" });
    expect(http.post).toHaveBeenCalledWith(SECRET_ENDPOINTS.UPDATE, {
      secretId: "s-1",
      name: "renamed",
      description: "why",
    });
  });

  it("rotate posts the new value", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    await service.rotate("s-1", "next");
    expect(http.post).toHaveBeenCalledWith(SECRET_ENDPOINTS.ROTATE, {
      secretId: "s-1",
      value: "next",
    });
  });

  it.each([
    ["lock", SECRET_ENDPOINTS.LOCK],
    ["unlock", SECRET_ENDPOINTS.UNLOCK],
    ["restore", SECRET_ENDPOINTS.RESTORE],
  ] as const)("%s posts the secret id", async (method, endpoint) => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    await service[method]("s-1");
    expect(http.post).toHaveBeenCalledWith(endpoint, { secretId: "s-1" });
  });

  it("remove uses DELETE with the id as a query parameter", async () => {
    vi.mocked(http.delete).mockResolvedValue({ isSuccess: true });
    await service.remove("s-1");
    expect(http.delete).toHaveBeenCalledWith(`${SECRET_ENDPOINTS.DELETE}?secretId=s-1`);
  });

  it("updateAccess posts to the dedicated access endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({ isSuccess: true });
    const access = { userIds: ["u-1"], roles: ["admin"] };
    await service.updateAccess("s-1", access);
    expect(http.post).toHaveBeenCalledWith(SECRET_ENDPOINTS.ACCESS, {
      secretId: "s-1",
      access,
    });
  });

  it("getAuditLogs sends the audit filter as a query", async () => {
    vi.mocked(http.get).mockResolvedValue({ data: [], totalCount: 0 });
    await service.getAuditLogs({ secretId: "s-1", pageNumber: 3, pageSize: 10 });
    const url = vi.mocked(http.get).mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("secretId")).toBe("s-1");
    expect(params.get("pageNumber")).toBe("3");
    expect(params.get("pageSize")).toBe("10");
  });
});
