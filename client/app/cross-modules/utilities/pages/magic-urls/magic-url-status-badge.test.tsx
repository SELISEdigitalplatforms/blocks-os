import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MagicUrlStatusBadge } from "./magic-url-status-badge";
import type { MagicUrl } from "@blocks-utilities/models/magic-url.model";

const make = (over: Partial<MagicUrl>): MagicUrl => ({ usageLimit: 0, usageCount: 0, ...over }) as MagicUrl;

describe("MagicUrlStatusBadge", () => {
  it("renders an explicit Active status", () => {
    render(<MagicUrlStatusBadge item={make({ status: "Active" })} />);
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("renders explicit Inactive/Disabled/Expired statuses", () => {
    const { rerender } = render(<MagicUrlStatusBadge item={make({ status: "Inactive" })} />);
    expect(screen.getByText("Inactive")).toBeTruthy();
    rerender(<MagicUrlStatusBadge item={make({ status: "Expired" })} />);
    expect(screen.getByText("Expired")).toBeTruthy();
  });

  it("falls back to a secondary badge for unknown statuses", () => {
    render(<MagicUrlStatusBadge item={make({ status: "Weird" })} />);
    expect(screen.getByText("Weird")).toBeTruthy();
  });

  it("derives Disabled when manually disabled and no status is set", () => {
    render(<MagicUrlStatusBadge item={make({ expiredReason: "ManuallyDisabled" })} />);
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("derives Limit Exceeded when the usage limit is reached", () => {
    render(<MagicUrlStatusBadge item={make({ usageLimit: 5, usageCount: 5 })} />);
    expect(screen.getByText("Limit Exceeded")).toBeTruthy();
  });

  it("derives Expired when the expiry date is in the past", () => {
    render(<MagicUrlStatusBadge item={make({ expiryDate: "2000-01-01T00:00:00Z" })} />);
    expect(screen.getByText("Expired")).toBeTruthy();
  });

  it("derives Expired from the isExpired flag", () => {
    render(<MagicUrlStatusBadge item={make({ isExpired: true })} />);
    expect(screen.getByText("Expired")).toBeTruthy();
  });

  it("defaults to Active when nothing indicates expiry", () => {
    render(
      <MagicUrlStatusBadge item={make({ expiryDate: "2999-01-01T00:00:00Z", isExpired: false })} />,
    );
    expect(screen.getByText("Active")).toBeTruthy();
  });
});
