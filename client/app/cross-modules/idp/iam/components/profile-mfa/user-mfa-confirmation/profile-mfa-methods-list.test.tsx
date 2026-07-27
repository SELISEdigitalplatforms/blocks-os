import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  projectMfaConfig: undefined as unknown,
  isLoading: false,
  isFetching: false,
  userData: undefined as unknown,
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGetProfileMFAConfig: () => ({
    isLoading: h.isLoading,
    isFetching: h.isFetching,
    data: h.projectMfaConfig,
  }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetProfileUserById: () => ({ data: h.userData }),
}));
vi.mock("../profile-mfa", async () => {
  const react = await import("react");
  return { profileMfaContext: react.createContext({ userId: "user-1", projectKey: "tenant-1" }) };
});

import { ProfileMFAMethodList } from "./profile-mfa-methods-list";

describe("ProfileMFAMethodList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.projectMfaConfig = { enabled: true, allowedMethods: [1, 2] };
    h.userData = { data: { mfaEnabled: false } };
  });

  it("renders the skeleton while the project config loads", () => {
    h.isLoading = true;
    const { container } = render(<ProfileMFAMethodList selected={0} setSelected={vi.fn()} />);
    expect(container.querySelector("[class*='h-5']")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("shows a message when project MFA is disabled", () => {
    h.projectMfaConfig = { enabled: false, allowedMethods: [1, 2] };
    render(<ProfileMFAMethodList selected={0} setSelected={vi.fn()} />);
    expect(
      screen.getByText("Multi-factor authentication is not enabled for this project."),
    ).toBeTruthy();
  });

  it("shows a message when no methods are available", () => {
    h.projectMfaConfig = { enabled: true, allowedMethods: [] };
    render(<ProfileMFAMethodList selected={0} setSelected={vi.fn()} />);
    expect(screen.getByText("No MFA methods are available for this project.")).toBeTruthy();
  });

  it("renders a radio option per allowed method and forwards selection", () => {
    const setSelected = vi.fn();
    render(<ProfileMFAMethodList selected={2} setSelected={setSelected} />);
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Authenticator app")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Authenticator app"));
    expect(setSelected).toHaveBeenCalledWith(1);
  });

  it("marks the currently enabled method with a badge", () => {
    h.userData = { data: { mfaEnabled: true, userMfaType: 2, isMfaVerified: true } };
    render(<ProfileMFAMethodList selected={2} setSelected={vi.fn()} />);
    expect(screen.getByText("Enabled")).toBeTruthy();
  });
});
