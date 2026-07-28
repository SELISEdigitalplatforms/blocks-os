import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  verifyAuth: undefined as { isSuccess?: boolean } | undefined,
  authenticateWithGithub: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "proj-1" } }),
}));
vi.mock("@/cross-modules/devops/hooks/github-info", () => ({
  useValidateAuthorization: () => ({ data: h.verifyAuth }),
}));
vi.mock("@/cross-modules/devops/services/providers.service", () => ({
  authenticateWithGithub: (...args: unknown[]) => h.authenticateWithGithub(...args),
  authenticateWithGitlab: vi.fn(),
  authenticateWithBitbucket: vi.fn(),
  authenticateWithAzure: vi.fn(),
  authenticateWithAws: vi.fn(),
}));

import ProviderButtons from "./render-provider";

describe("ProviderButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.verifyAuth = undefined;
    localStorage.clear();
  });

  it("renders a button per provider, disabling the inactive ones", () => {
    render(<ProviderButtons destination="" />);
    expect(screen.getByText("Continue with GitHub")).toBeTruthy();
    expect(
      (screen.getByText("Continue with GitLab").closest("button") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("stores the destination when one is provided", () => {
    render(<ProviderButtons destination="/devops/custom" />);
    expect(localStorage.getItem("destination")).toBe("/devops/custom");
  });

  it("closes via onClose when GitHub is already authorized", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    h.verifyAuth = { isSuccess: true };
    render(<ProviderButtons destination="/devops/x" onClose={onClose} />);
    await user.click(screen.getByText("Continue with GitHub"));
    expect(onClose).toHaveBeenCalledWith(true);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("navigates to the destination when authorized without an onClose handler", async () => {
    const user = userEvent.setup();
    h.verifyAuth = { isSuccess: true };
    render(<ProviderButtons destination="/devops/target" />);
    await user.click(screen.getByText("Continue with GitHub"));
    expect(h.navigate).toHaveBeenCalledWith("/devops/target");
  });

  it("falls back to the default destination when none is provided", async () => {
    const user = userEvent.setup();
    h.verifyAuth = { isSuccess: true };
    render(<ProviderButtons destination={undefined as unknown as string} />);
    await user.click(screen.getByText("Continue with GitHub"));
    expect(h.navigate).toHaveBeenCalledWith("/devops/configure");
  });

  it("starts GitHub authentication and resolves onClose on the reload storage event", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    h.verifyAuth = { isSuccess: false };
    render(<ProviderButtons destination="/devops/y" onClose={onClose} extraState="state-9" />);
    await user.click(screen.getByText("Continue with GitHub"));

    expect(h.authenticateWithGithub).toHaveBeenCalledWith("state-9", "proj-1");
    expect(onClose).not.toHaveBeenCalled();

    localStorage.setItem("isReload", "1");
    window.dispatchEvent(new StorageEvent("storage", { key: "isReload", newValue: "1" }));
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
