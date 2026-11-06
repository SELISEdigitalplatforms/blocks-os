import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { EMAIL_TEMPLATE_ENDPOINTS } from "@blocks-communication/mail/constants/endpoint.constant";
import { emailService } from "./email.services";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const post = http.post as unknown as ReturnType<typeof vi.fn>;
const get = http.get as unknown as ReturnType<typeof vi.fn>;

describe("email service: copy to organizations (SPEC33 §6.1, §6.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockResolvedValue({ isSuccess: true, itemId: "job-1" });
    get.mockResolvedValue({ isSuccess: true, copies: [] });
  });

  it("posts the copy request to Mail/CopyTemplateToOrganizations (H1)", async () => {
    const result = await emailService.copyTemplateToOrganizations({
      templateId: "d-order-en",
      allOrganizations: false,
      organizationIds: ["acme", "globex"],
      existing: "keep",
    });
    expect(EMAIL_TEMPLATE_ENDPOINTS.COPY_TEMPLATE_TO_ORGANIZATIONS).toMatch(
      /\/Mail\/CopyTemplateToOrganizations$/,
    );
    expect(post.mock.calls[0][0]).toBe(EMAIL_TEMPLATE_ENDPOINTS.COPY_TEMPLATE_TO_ORGANIZATIONS);
    expect(post.mock.calls[0][1]).toEqual({
      templateId: "d-order-en",
      allOrganizations: false,
      organizationIds: ["acme", "globex"],
      existing: "keep",
    });
    expect(result.itemId).toBe("job-1");
  });

  it("asks which organizations already have a copy, ids comma separated (H9)", async () => {
    await emailService.getTemplateOrganizationCopies("d-order-en", ["acme", "globex"]);
    expect(get.mock.calls[0][0]).toBe(
      `${EMAIL_TEMPLATE_ENDPOINTS.GET_TEMPLATE_ORGANIZATION_COPIES}?templateId=d-order-en&organizationIds=acme%2Cglobex`,
    );
  });
});
