import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailUsage } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  data: undefined as IEmailUsage | null | undefined,
  isLoading: false,
}));

vi.mock("@blocks-communication/mail/hooks/use-email-usage", () => ({
  useGetEmailUsageById: () => ({ data: h.data, isLoading: h.isLoading }),
}));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-details-breadcrumb", () => ({
  EmailUsageDetailsBreadcrumb: () => <nav>breadcrumb</nav>,
}));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-details-skeleton", () => ({
  EmailUsageDetailsSkeleton: () => <div>skeleton</div>,
}));

import { EmailUsageDetails } from "./email-usage-details";

const mail = (over: Partial<IEmailUsage> = {}): IEmailUsage =>
  ({
    messageId: "m-1",
    from: '"Abdullah Al Momen" <momen@gmail.com>',
    to: "support@amlora.ch",
    subject: "inbound test 1",
    body: "Test Inbound",
    status: "Received",
    error: "",
    date: "2026-09-23T13:25:49Z",
    isInbound: true,
    rawMime: "Subject: inbound test 1\r\n\r\nTest Inbound",
    ...over,
  }) as IEmailUsage;

describe("EmailUsageDetails", () => {
  beforeEach(() => {
    h.isLoading = false;
    h.data = mail();
  });

  it("shows the subject, sender and recipient", () => {
    render(<EmailUsageDetails id="m-1" />);
    expect(screen.getByRole("heading", { name: "inbound test 1" })).toBeTruthy();
    expect(screen.getByText("Abdullah Al Momen")).toBeTruthy();
    expect(screen.getByText("<momen@gmail.com>")).toBeTruthy();
    expect(screen.getByText("support@amlora.ch")).toBeTruthy();
    // An inbound mail's status is implied.
    expect(screen.queryByText("Received")).toBeNull();
  });

  it("renders the HTML body in a frame that cannot run scripts", () => {
    h.data = mail({
      content: { htmlBody: "<div>Test <b>Inbound</b></div>", textBody: "Test Inbound", attachments: [] },
    });
    render(<EmailUsageDetails id="m-1" />);

    const frame = screen.getByTitle("Email body") as HTMLIFrameElement;
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("<b>Inbound</b>");
  });

  it("falls back to plain text and can show the original source", async () => {
    render(<EmailUsageDetails id="m-1" />);
    expect(screen.getByText("Test Inbound")).toBeTruthy();

    await userEvent.click(screen.getByRole("tab", { name: "Original" }));
    expect(screen.getByText(/Subject: inbound test 1/)).toBeTruthy();
  });

  it("lists attachments", () => {
    h.data = mail({
      content: {
        textBody: "see attached",
        attachments: [{ fileName: "invoice.pdf", contentType: "application/pdf", size: 2048 }],
      },
    });
    render(<EmailUsageDetails id="m-1" />);
    expect(screen.getByText("1 attachment")).toBeTruthy();
    expect(screen.getByText("invoice.pdf")).toBeTruthy();
  });

  it("shows a not-found state", () => {
    h.data = null;
    render(<EmailUsageDetails id="missing" />);
    expect(screen.getByText("Email details not found.")).toBeTruthy();
  });
});
