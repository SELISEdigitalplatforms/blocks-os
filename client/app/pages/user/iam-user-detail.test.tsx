import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  params: { id: "u1" } as Record<string, string | undefined>,
  userProps: null as Record<string, unknown> | null,
}));

vi.mock("react-router", () => ({
  useParams: () => h.params,
}));
vi.mock("@blocks-idp/iam/modules/user-management/user", () => ({
  User: (props: Record<string, unknown>) => {
    h.userProps = props;
    return <div data-testid="user-detail" />;
  },
}));

import IamUserDetailPage from "./iam-user-detail";

beforeEach(() => {
  vi.clearAllMocks();
  h.params = { id: "u1" };
  h.userProps = null;
});

describe("IamUserDetailPage", () => {
  it("renders the user detail component", () => {
    render(<IamUserDetailPage />);
    expect(screen.getByTestId("user-detail")).toBeTruthy();
  });

  it("passes the route id through", () => {
    h.params = { id: "abc-123" };
    render(<IamUserDetailPage />);
    expect(h.userProps?.id).toBe("abc-123");
  });
});
