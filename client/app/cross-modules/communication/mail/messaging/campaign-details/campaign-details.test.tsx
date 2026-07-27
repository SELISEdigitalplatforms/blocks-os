import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <div data-testid="crumb" /> }));
vi.mock(
  "@blocks-communication/mail/components/messaging/campaign-creation/campaign-creation",
  () => ({ default: () => <div data-testid="campaign-creation" /> }),
);

import { CampaignDetails } from "./campaign-details";
import { messagingServiceData } from "@blocks-communication/mail/constants/messaging";

describe("CampaignDetails", () => {
  it("shows a loading state for an unknown campaign id", () => {
    render(<CampaignDetails params={{ id: "does-not-exist" }} />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders the details of a known campaign", () => {
    const first = messagingServiceData[0];
    render(<CampaignDetails params={{ id: first.id }} />);
    expect(screen.getByRole("heading", { name: first.name })).toBeTruthy();
    expect(screen.getByText(first.configuration)).toBeTruthy();
    expect(screen.getByText(first.protocol)).toBeTruthy();
    expect(screen.getByText("Edit Messages")).toBeTruthy();
  });
});
