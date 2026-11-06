import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cardProps: null as Record<string, unknown> | null,
  user: { itemId: "u1" } as Record<string, unknown>,
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: { data: h.user } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user-manageability", () => import("@/test-utils/__mocks__/user-manageability.mock"));

vi.mock("@blocks-idp/iam/security/components/session-list-card", () => ({
  SessionListCard: (props: Record<string, unknown>) => {
    h.cardProps = props;
    return <div data-testid="session-list-card" />;
  },
}));

import { UserDevices } from "./user-devices";
import { manageability, resetManageability } from "@/test-utils/__mocks__/user-manageability.mock";

beforeEach(() => {
  vi.clearAllMocks();
  h.cardProps = null;
  resetManageability();
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

  it("passes no reason for a user the caller can manage", () => {
    render(<UserDevices id="u1" projectKey="tenant-1" />);
    expect(h.cardProps?.readOnlyReason).toBeUndefined();
  });

  it("passes the reason for a user the caller cannot manage", () => {
    manageability.blockedIds.add("u1");
    render(<UserDevices id="u1" projectKey="tenant-1" />);
    expect(h.cardProps?.readOnlyReason).toBe("You can't manage this user.");
  });
});
