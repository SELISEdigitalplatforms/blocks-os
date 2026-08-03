import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ cardProps: null as Record<string, unknown> | null }));

vi.mock("@blocks-idp/iam/security/components/session-list-card", () => ({
  SessionListCard: (props: Record<string, unknown>) => {
    h.cardProps = props;
    return <div data-testid="session-list-card" />;
  },
}));

import { UserDevices } from "./user-devices";

beforeEach(() => {
  vi.clearAllMocks();
  h.cardProps = null;
});

describe("UserDevices", () => {
  it("renders the session list for the given user", () => {
    render(<UserDevices id="u1" projectKey="tenant-1" />);
    expect(screen.getByTestId("session-list-card")).toBeTruthy();
    expect(h.cardProps?.userId).toBe("u1");
  });

  it("enables the sign-out action", () => {
    render(<UserDevices id="u1" projectKey="tenant-1" />);
    expect(h.cardProps?.showSignOut).toBe(true);
  });
});
