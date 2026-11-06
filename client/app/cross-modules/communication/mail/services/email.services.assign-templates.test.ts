import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { EMAIL_TEMPLATE_ENDPOINTS } from "@blocks-communication/mail/constants/endpoint.constant";
import { emailService } from "./email.services";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const post = http.post as unknown as ReturnType<typeof vi.fn>;

describe("email service: assign templates (SPEC32 §6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ isSuccess: true, updatedCount: 2 });
  });

  it("posts the chosen ids to Mail/AssignTemplates (H1)", async () => {
    const result = await emailService.assignTemplates({
      configurationId: "acme-smtp",
      allMatching: false,
      templateIds: ["a1", "a2"],
    });
    expect(EMAIL_TEMPLATE_ENDPOINTS.ASSIGN_TEMPLATES).toMatch(/\/Mail\/AssignTemplates$/);
    expect(post.mock.calls[0][0]).toBe(EMAIL_TEMPLATE_ENDPOINTS.ASSIGN_TEMPLATES);
    expect(post.mock.calls[0][1]).toEqual({
      configurationId: "acme-smtp",
      allMatching: false,
      templateIds: ["a1", "a2"],
    });
    expect(result.updatedCount).toBe(2);
  });

  it("posts all-matching mode with the list's filters (H2, H3)", async () => {
    await emailService.assignTemplates({
      configurationId: "acme-smtp",
      allMatching: true,
      searchKey: "Order",
      language: "en-US",
    });
    expect(post.mock.calls[0][1]).toEqual({
      configurationId: "acme-smtp",
      allMatching: true,
      searchKey: "Order",
      language: "en-US",
    });
  });
});
