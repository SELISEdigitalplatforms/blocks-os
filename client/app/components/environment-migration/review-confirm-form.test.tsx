import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  selectedTenantGroup: "group-1" as string | undefined,
  initiate: vi.fn(),
  verify: vi.fn(),
  isInitiating: false,
  isVerifying: false,
  remainingTime: 0,
  reset: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useProjectStore: () => ({ selectedTenantGroup: h.selectedTenantGroup }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useCountDown: () => ({ remainingTime: h.remainingTime, reset: h.reset }),
}));
vi.mock("@/hooks/use-project", () => ({
  useInitiateMigration: () => ({ mutateAsync: h.initiate, isPending: h.isInitiating }),
  useVerifyMigration: () => ({ mutateAsync: h.verify, isPending: h.isVerifying }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { ReviewConfirmForm } from "./review-confirm-form";
import { useDataMigrationFormState } from "./migration-form-state";

const seedSelection = () => {
  useDataMigrationFormState.getState().setFormData(0, {
    sourceEnvironment: "tenant-dev",
    sourceEnvironmentName: "Development",
    targetEnvironment: "tenant-prod",
    targetEnvironmentName: "Production",
    services: [
      { name: "Email", label: "Email", selected: true, overrideData: true },
      { name: "Language", label: "Language", selected: true, overrideData: false },
      { name: "IAM", label: "IAM", selected: false, overrideData: false },
    ],
  });
};

describe("ReviewConfirmForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedTenantGroup = "group-1";
    h.isInitiating = false;
    h.isVerifying = false;
    h.remainingTime = 0;
    useDataMigrationFormState.getState().resetFormData();
    seedSelection();
    h.initiate.mockResolvedValue({ isSuccess: true, verificationId: "verify-1" });
    h.verify.mockResolvedValue({ isSuccess: true, isValid: true });
  });

  it("renders the migration summary with environments and selected services", () => {
    render(<ReviewConfirmForm />);
    expect(screen.getByText("Review & confirm")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("Production")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Language")).toBeTruthy();
    // Unselected services are not listed.
    expect(screen.queryByText("IAM")).toBeNull();
  });

  it("disables the start button when no services are selected", () => {
    useDataMigrationFormState.getState().setFormData(0, {
      sourceEnvironment: "",
      sourceEnvironmentName: "",
      targetEnvironment: "",
      targetEnvironmentName: "",
      services: [{ name: "Email", label: "Email", selected: false, overrideData: false }],
    });
    render(<ReviewConfirmForm />);
    const start = screen.getByRole("button", { name: "Start migration" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
  });

  it("initiates migration and opens the verification modal on success", async () => {
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));

    await waitFor(() => expect(h.initiate).toHaveBeenCalledTimes(1));
    const payload = h.initiate.mock.calls[0][0];
    expect(payload.projectKey).toBe("tenant-dev");
    expect(payload.targetedProjectKey).toBe("tenant-prod");
    expect(payload.tenantGroupId).toBe("group-1");
    // Only selected services are included in the payload.
    expect(payload.services).toHaveLength(2);
    expect(await screen.findByText("Verify your migration")).toBeTruthy();
  });

  it("reports an error when initiating fails without a verification id", async () => {
    h.initiate.mockResolvedValue({ isSuccess: false });
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { general: "Failed to initiate migration" },
      }),
    );
  });

  it("reports an error when initiating throws", async () => {
    h.initiate.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { general: "An error occurred while initiating migration" },
      }),
    );
  });

  it("blocks migration and warns when no tenant group is selected", async () => {
    h.selectedTenantGroup = undefined;
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));
    expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "No project selected" } });
    expect(h.initiate).not.toHaveBeenCalled();
  });

  it("verifies the code and navigates on success", async () => {
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));
    await screen.findByText("Verify your migration");

    const otp = document.querySelector("input[data-input-otp]") as HTMLInputElement;
    await user.type(otp, "12345");
    await user.click(screen.getByRole("button", { name: "Verify & Begin" }));

    await waitFor(() =>
      expect(h.verify).toHaveBeenCalledWith({
        verificationId: "verify-1",
        verificationCode: "12345",
      }),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Migration started successfully!" });
    expect(h.navigate).toHaveBeenCalledWith("/app/project/group-1/environments");
  });

  it("shows an error toast when the verification code is invalid", async () => {
    h.verify.mockResolvedValue({ isSuccess: true, isValid: false });
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));
    await screen.findByText("Verify your migration");
    const otp = document.querySelector("input[data-input-otp]") as HTMLInputElement;
    await user.type(otp, "99999");
    await user.click(screen.getByRole("button", { name: "Verify & Begin" }));
    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        errors: { general: "Invalid verification code" },
      }),
    );
  });

  it("resends the verification code from the modal", async () => {
    const user = userEvent.setup();
    render(<ReviewConfirmForm />);
    await user.click(screen.getByRole("button", { name: "Start migration" }));
    await screen.findByText("Verify your migration");

    h.initiate.mockClear();
    await user.click(screen.getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(h.initiate).toHaveBeenCalledTimes(1));
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Verification code sent successfully!",
    });
  });
});
