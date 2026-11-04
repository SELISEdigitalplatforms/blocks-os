import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => ({
  http: {
    post: h.post,
  },
}));

import {
  SignupLinkSummaryService,
  signupLinkSummaryService,
} from "./signup-link-summary.service";
import { SIGNUP_LINK_ENDPOINTS } from "../constants/endpoint.constant";

describe("SignupLinkSummaryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the summary payload to SUMMARY only", async () => {
    h.post.mockResolvedValue({
      configurationId: "c1",
      configurationName: "Partner",
      fromUtc: "2026-01-01T00:00:00Z",
      toUtc: "2026-01-31T00:00:00Z",
      totalGenerated: 1,
      used: 0,
      neverUsed: 1,
      neverUsedBreakdown: { active: 1, expired: 0, revoked: 0 },
      rejectedAttempts: 0,
    });
    const payload = { configurationId: "c1" };
    await signupLinkSummaryService.getSummary(payload);
    expect(h.post).toHaveBeenCalledWith(SIGNUP_LINK_ENDPOINTS.SUMMARY, payload, undefined, {
      absoluteUrl: true,
    });
  });

  it("exposes only getSummary (C2)", () => {
    const methods = Object.getOwnPropertyNames(SignupLinkSummaryService.prototype).filter(
      (name) => name !== "constructor",
    );
    expect(methods).toEqual(["getSummary"]);
  });
});
