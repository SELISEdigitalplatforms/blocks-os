import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IPATResponse } from "@blocks-idp/iam/models/user";

const h = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@seliseblocks/genesis-os/hooks", () => ({ useIsMobile: () => h.isMobile }));
vi.mock("./generate-pat-modal", () => ({
  GenerateTokenModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="generate-modal" /> : null,
}));
vi.mock("@/components/copy-to-clipboard-button/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { UserPATList } from "./user-pats-list";

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

const pat = (over: Partial<IPATResponse> = {}): IPATResponse =>
  ({
    note: "CI token",
    code: "pat-abc-123",
    expiryDate: future,
    ...over,
  }) as IPATResponse;

describe("UserPATList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isMobile = false;
  });

  it("shows the loading skeleton while loading", () => {
    const { container } = render(<UserPATList isLoading data={[]} id="u-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders an empty state when there are no tokens", () => {
    render(<UserPATList isLoading={false} data={[]} id="u-1" />);
    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("renders active and expired tokens with their status badges", () => {
    render(
      <UserPATList
        isLoading={false}
        data={[pat({ note: "live", expiryDate: future }), pat({ note: "dead", expiryDate: past })]}
        id="u-1"
      />,
    );
    expect(screen.getByText("live")).toBeTruthy();
    expect(screen.getByText("dead")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("expired")).toBeTruthy();
  });

  it("opens the generate token modal from the header action", async () => {
    const user = userEvent.setup();
    render(<UserPATList isLoading={false} data={[pat()]} id="u-1" />);
    expect(screen.queryByTestId("generate-modal")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Generate PAT" }));
    expect(screen.getByTestId("generate-modal")).toBeTruthy();
  });

  it("renders the mobile token layout when on a small screen", () => {
    h.isMobile = true;
    render(<UserPATList isLoading={false} data={[pat({ code: "mobile-code" })]} id="u-1" />);
    expect(screen.getAllByText("mobile-code").length).toBeGreaterThan(0);
    expect(screen.getByText("Copy")).toBeTruthy();
  });
});
