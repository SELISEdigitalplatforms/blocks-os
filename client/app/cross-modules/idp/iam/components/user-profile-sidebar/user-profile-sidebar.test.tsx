import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  userByIdData: undefined as { data: Record<string, unknown> } | undefined,
}));

vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userByIdData }),
}));
vi.mock("@blocks-idp/iam/components/profile-image-uploader", () => ({
  ProfileImageUploader: () => <div data-testid="image-uploader" />,
}));
vi.mock("@/components/copy-to-clipboard-button", () => ({
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { UserProfileSidebar } from "./user-profile-sidebar";

beforeEach(() => {
  vi.clearAllMocks();
  h.userByIdData = undefined;
});

describe("UserProfileSidebar", () => {
  it("renders the fetched user's details", () => {
    h.userByIdData = {
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        active: true,
        logInCount: 4,
        lastLoggedInTime: "2022-05-01T10:00:00Z",
      },
    };
    render(<UserProfileSidebar id="u1" projectKey="p1" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("marks an inactive user as Inactive", () => {
    h.userByIdData = { data: { firstName: "Bob", active: false } };
    render(<UserProfileSidebar id="u2" projectKey="p1" />);
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("shows Never when there is no valid last login", () => {
    h.userByIdData = { data: { firstName: "Ada", active: true } };
    render(<UserProfileSidebar id="u1" projectKey="p1" />);
    expect(screen.getByText("Never")).toBeTruthy();
  });

  it("renders the avatar uploader", () => {
    h.userByIdData = { data: { firstName: "Ada", active: true } };
    render(<UserProfileSidebar id="u1" projectKey="p1" />);
    expect(screen.getByTestId("image-uploader")).toBeTruthy();
  });
});
