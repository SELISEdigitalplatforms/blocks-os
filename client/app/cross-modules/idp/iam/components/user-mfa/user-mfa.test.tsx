import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mfaConfig: undefined as unknown,
  mfaConfigLoading: false,
  userData: undefined as unknown,
  userLoading: false,
  userFetching: false,
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGetMFAConfig: () => ({ data: h.mfaConfig, isLoading: h.mfaConfigLoading }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({
    data: h.userData,
    isLoading: h.userLoading,
    isFetching: h.userFetching,
  }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("./user-mfa-confirmation/user-mfa-confirmation-disable", () => ({
  UserMFAConfirmationDisable: () => <div>disable-mfa</div>,
}));
vi.mock("./user-mfa-detail", () => ({
  UserMFADetails: () => <div>mfa-details</div>,
}));

import { UserMFA } from "./user-mfa";

const renderMfa = () =>
  render(
    <MemoryRouter>
      <UserMFA userId="user-1" projectKey="tenant-1" />
    </MemoryRouter>,
  );

describe("UserMFA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mfaConfig = undefined;
    h.mfaConfigLoading = false;
    h.userData = undefined;
    h.userLoading = false;
    h.userFetching = false;
  });

  it("shows the loading skeleton while the MFA config loads", () => {
    h.mfaConfigLoading = true;
    const { container } = renderMfa();
    expect(screen.getByText("Multi-factor Authentication")).toBeTruthy();
    expect(container.querySelector(".animate-pulse, [class*='skeleton']")).toBeTruthy();
    expect(screen.queryByText("mfa-details")).toBeNull();
  });

  it("shows the project-level MFA guidance when MFA is not enabled for the project", () => {
    h.mfaConfig = { enabled: false };
    renderMfa();
    expect(screen.getByText("Go to MFA Settings")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to MFA Settings" }).getAttribute("href")).toBe(
      "/app/proj/secret-management/mfa",
    );
  });

  it("renders the user MFA config with details when enabled", () => {
    h.mfaConfig = { enabled: true };
    h.userData = { data: { mfaEnabled: true } };
    renderMfa();
    expect(screen.getByText("mfa-details")).toBeTruthy();
    expect(screen.getByText("disable-mfa")).toBeTruthy();
  });

  it("hides the disable action when the user has MFA disabled", () => {
    h.mfaConfig = { enabled: true };
    h.userData = { data: { mfaEnabled: false } };
    renderMfa();
    expect(screen.getByText("mfa-details")).toBeTruthy();
    expect(screen.queryByText("disable-mfa")).toBeNull();
  });
});
