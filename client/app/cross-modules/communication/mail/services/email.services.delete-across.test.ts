import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { EMAIL_TEMPLATE_ENDPOINTS } from "@blocks-communication/mail/constants/endpoint.constant";
import { emailService } from "./email.services";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const post = http.post as unknown as ReturnType<typeof vi.fn>;

describe("email service: delete across organizations (SPEC34 §6.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ isSuccess: true, itemId: "job-9" });
  });

  it("posts the request to Mail/DeleteTemplateAcrossOrganizations (H2)", async () => {
    const result = await emailService.deleteTemplateAcrossOrganizations({
      templateId: "d-order-en",
      allOrganizations: false,
      organizationIds: ["umbrella"],
    });
    expect(EMAIL_TEMPLATE_ENDPOINTS.DELETE_TEMPLATE_ACROSS_ORGANIZATIONS).toMatch(
      /\/Mail\/DeleteTemplateAcrossOrganizations$/,
    );
    expect(post.mock.calls[0][0]).toBe(
      EMAIL_TEMPLATE_ENDPOINTS.DELETE_TEMPLATE_ACROSS_ORGANIZATIONS,
    );
    expect(post.mock.calls[0][1]).toEqual({
      templateId: "d-order-en",
      allOrganizations: false,
      organizationIds: ["umbrella"],
    });
    expect(post.mock.calls[0][3]).toEqual({ absoluteUrl: true });
    expect(result.itemId).toBe("job-9");
  });
});
