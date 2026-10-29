import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => ({
  http: {
    post: h.post,
    get: h.get,
    patch: h.patch,
  },
}));

import { signupLinkConfigurationService } from "./signup-link-configuration.service";
import { SIGNUP_LINK_CONFIGURATION_ENDPOINTS } from "../constants/endpoint.constant";

describe("SignupLinkConfigurationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the query payload to /query", async () => {
    h.post.mockResolvedValue({ items: [], totalCount: 0 });
    const payload = { page: 0, pageSize: 10, includeInactive: false, search: "x" };
    await signupLinkConfigurationService.query(payload);
    expect(h.post).toHaveBeenCalledWith(
      SIGNUP_LINK_CONFIGURATION_ENDPOINTS.QUERY,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  });

  it("creates on BASE and patches/archives by id", async () => {
    h.post.mockResolvedValue({ isSuccess: true, itemId: "1" });
    h.patch.mockResolvedValue({ isSuccess: true, itemId: "1" });
    await signupLinkConfigurationService.create({
      name: "n",
      defaultRoles: [],
      defaultPermissions: [],
      clientId: "c",
      redirectUri: "https://a.com",
      credentialMode: "Passwordless",
    });
    expect(h.post).toHaveBeenCalledWith(
      SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE,
      expect.any(Object),
      undefined,
      { absoluteUrl: true },
    );
    await signupLinkConfigurationService.update({ itemId: "1", description: "d" });
    expect(h.patch).toHaveBeenCalledWith(
      `${SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE}/1`,
      { description: "d" },
      undefined,
      { absoluteUrl: true },
    );
    await signupLinkConfigurationService.archive("1");
    expect(h.post).toHaveBeenCalledWith(
      `${SIGNUP_LINK_CONFIGURATION_ENDPOINTS.BASE}/1/archive`,
      {},
      undefined,
      { absoluteUrl: true },
    );
  });
});
