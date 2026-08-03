import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  profile: { isLoading: false, data: undefined as unknown },
  byId: { isLoading: false, data: undefined as unknown },
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetProfileUserById: () => h.profile,
  useGetUserById: () => h.byId,
}));

import { UserBasicInformation } from "./user-basic-information";

const userData = (over: Record<string, unknown> = {}) => ({
  data: {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    logInCount: 7,
    active: true,
    lastLoggedInTime: "2025-01-01T00:00:00Z",
    userCreationType: 1,
    ...over,
  },
});

describe("UserBasicInformation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.profile = { isLoading: false, data: undefined };
    h.byId = { isLoading: false, data: undefined };
  });

  it("renders nothing when there is no data and it is not loading", () => {
    const { container } = render(<UserBasicInformation id="u1" projectKey="pk" />);
    expect(container.textContent).toBe("");
  });

  it("renders the by-id user details when not viewing own profile", () => {
    h.byId = { isLoading: false, data: userData() };
    render(<UserBasicInformation id="u1" projectKey="pk" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Portal")).toBeTruthy();
  });

  it("renders the inactive badge and login fallback", () => {
    h.byId = {
      isLoading: false,
      data: userData({ active: false, logInCount: undefined, lastLoggedInTime: undefined, userCreationType: undefined }),
    };
    render(<UserBasicInformation id="u1" projectKey="pk" />);
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("reads from the profile query when viewing own profile and shows skeletons while loading", () => {
    h.profile = { isLoading: true, data: undefined };
    render(<UserBasicInformation id="u1" projectKey="pk" own />);
    expect(screen.getByText("Basic Information")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
  });
});
