import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { AuthService } from "./auth.service";
import { AUTH_ENDPOINTS } from "../constants/endpoint.constant";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── logout ─────────────────────────────────────────────────────────────────
  describe("logout", () => {
    it("should POST to the LOGOUT endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue(undefined);

      await service.logout();

      expect(http.post).toHaveBeenCalledWith(AUTH_ENDPOINTS.LOGOUT, {}, undefined, {
        absoluteUrl: true,
      });
    });

    it("should throw when the API call fails", async () => {
      vi.mocked(http.post).mockRejectedValue(new Error("Network error"));

      await expect(service.logout()).rejects.toThrow("Network error");
    });
  });
});
