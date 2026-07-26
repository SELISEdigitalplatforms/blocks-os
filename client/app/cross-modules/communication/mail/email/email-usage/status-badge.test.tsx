import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";
import { MailStatus } from "@blocks-communication/mail/models/email";

describe("StatusBadge", () => {
  it("renders a success badge for delivered mail", () => {
    render(<StatusBadge status={MailStatus.Delivered} />);
    expect(screen.getByText("Delivered")).toBeTruthy();
  });

  it("renders an error badge for bounced, complained and rejected mail", () => {
    for (const status of [MailStatus.Bounced, MailStatus.Complained, MailStatus.Rejected]) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeTruthy();
      unmount();
    }
  });

  it("renders a secondary badge for received mail", () => {
    render(<StatusBadge status={MailStatus.Received} />);
    expect(screen.getByText("Received")).toBeTruthy();
  });

  it("falls back to the info variant for an unknown status", () => {
    render(<StatusBadge status="Queued" />);
    expect(screen.getByText("Queued")).toBeTruthy();
  });
});
