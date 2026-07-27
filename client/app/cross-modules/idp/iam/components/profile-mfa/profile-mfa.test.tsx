import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGetProfileMFAConfig: () => ({ data: h.data, isLoading: h.isLoading }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("./profile-mfa-detail", () => ({ ProfileMFADetails: () => <div data-testid="details" /> }));
vi.mock("./user-mfa-confirmation/profile-mfa-methods-select-list", () => ({
  ProfileMfaMethodSelectList: () => <div data-testid="method-list" />,
}));

import { ProfileMFA } from "./profile-mfa";

const renderProfile = () =>
  render(
    <MemoryRouter>
      <ProfileMFA userId="user-1" projectKey="tenant-1" />
    </MemoryRouter>,
  );

describe("ProfileMFA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.data = undefined;
    h.isLoading = false;
  });

  it("renders the loading skeleton while the config loads", () => {
    h.isLoading = true;
    renderProfile();
    expect(screen.getByText("Multi-factor Authentication")).toBeTruthy();
    expect(screen.queryByTestId("details")).toBeNull();
  });

  it("renders the project MFA guidance when MFA is not enabled", () => {
    h.data = { enabled: false };
    renderProfile();
    expect(screen.getByText("Go to MFA Settings")).toBeTruthy();
    expect(screen.queryByTestId("method-list")).toBeNull();
  });

  it("renders the profile MFA config with details and method list when enabled", () => {
    h.data = { enabled: true };
    renderProfile();
    expect(screen.getByTestId("details")).toBeTruthy();
    expect(screen.getByTestId("method-list")).toBeTruthy();
  });
});
