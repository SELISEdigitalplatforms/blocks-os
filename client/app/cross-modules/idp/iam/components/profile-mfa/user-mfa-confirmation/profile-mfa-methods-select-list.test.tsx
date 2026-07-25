import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  projectMfaConfig: undefined as unknown,
  userData: undefined as unknown,
  showVerifyModal: vi.fn(),
  setIsDisableModalOpen: vi.fn(),
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGetProfileMFAConfig: () => ({ data: h.projectMfaConfig }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetProfileUserById: () => ({ data: h.userData }),
}));
vi.mock("./profile-mfa-veriffy", () => ({ ProfileMFAVerify: () => <div data-testid="verify" /> }));
vi.mock("./profile-mfa-confirmation-disable", () => ({
  UserMFAConfirmationDisable: () => <div data-testid="disable" />,
}));
// Standalone context to avoid importing the heavy profile-mfa module tree.
vi.mock("../profile-mfa", async () => {
  const react = await import("react");
  return {
    profileMfaContext: react.createContext({
      userId: "user-1",
      projectKey: "tenant-1",
      showVerifyModal: h.showVerifyModal,
      setIsDisableModalOpen: h.setIsDisableModalOpen,
    }),
  };
});

import { ProfileMfaMethodSelectList } from "./profile-mfa-methods-select-list";

describe("ProfileMfaMethodSelectList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.projectMfaConfig = { enabled: true, allowedMethods: [1, 2] };
    h.userData = { data: { userMfaType: 0, isMfaVerified: false } };
  });

  it("always renders the None option plus the allowed methods", () => {
    render(<ProfileMfaMethodSelectList />);
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Authenticator app")).toBeTruthy();
    expect(screen.getByTestId("verify")).toBeTruthy();
    expect(screen.getByTestId("disable")).toBeTruthy();
  });

  it("renders no extra methods when the project MFA is disabled", () => {
    h.projectMfaConfig = { enabled: false, allowedMethods: [1, 2] };
    render(<ProfileMfaMethodSelectList />);
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.queryByText("Email")).toBeNull();
  });

  it("opens the verify modal when enabling a method", () => {
    render(<ProfileMfaMethodSelectList />);
    // Email method type is 2, active type is 0 -> shows an Enable button.
    const enableButtons = screen.getAllByRole("button", { name: "Enable" });
    fireEvent.click(enableButtons[0]);
    expect(h.showVerifyModal).toHaveBeenCalled();
  });

  it("opens the disable modal when disabling from the None row", () => {
    h.userData = { data: { userMfaType: 2, isMfaVerified: true } };
    render(<ProfileMfaMethodSelectList />);
    // With active type 2, the None row (type 0) offers a Disable button.
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    expect(h.setIsDisableModalOpen).toHaveBeenCalledWith(true);
  });
});
