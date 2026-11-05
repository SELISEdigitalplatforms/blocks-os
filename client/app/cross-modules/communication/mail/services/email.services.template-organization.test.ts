import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http/http-client";
import { emailService } from "./email.services";

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

const h = {
  get: http.get as unknown as ReturnType<typeof vi.fn>,
  post: http.post as unknown as ReturnType<typeof vi.fn>,
};

describe("email service: templates per organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.get.mockResolvedValue({ templates: [], totalCount: 0 });
    h.post.mockResolvedValue({ isSuccess: true });
  });

  it("asks GetTemplates for one organization (H4)", async () => {
    await emailService.fetchEmailTemplates(0, 10, "", "Name", false, "", "", "acme corp");
    expect(h.get.mock.calls[0][0]).toContain("&organizationId=acme%20corp");
  });

  it("leaves organizationId out when none is given (H5: the server's Default)", async () => {
    await emailService.fetchEmailTemplates(0, 10, "", "Name", false, "", "");
    expect(h.get.mock.calls[0][0]).not.toContain("organizationId");
  });

  it("sends the template id with a test mail so that exact template is sent (H12, §6.7)", async () => {
    await emailService.sendTestMail({
      to: "user@example.com",
      purpose: "Welcome",
      language: "en-US",
      templateId: "t-acme",
    });
    expect(h.post.mock.calls[0][1]).toEqual({
      to: ["user@example.com"],
      purpose: "Welcome",
      language: "en-US",
      replyTo: ["user@example.com"],
      isTestMail: true,
      templateId: "t-acme",
    });
  });
});
