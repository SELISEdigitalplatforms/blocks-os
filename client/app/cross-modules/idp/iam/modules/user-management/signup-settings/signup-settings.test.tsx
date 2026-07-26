import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  settingData: undefined as unknown,
  saveSignUpSetting: vi.fn(),
  isPending: false,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetSignUpSetting: () => ({ data: h.settingData }),
  useSaveSignUpSetting: () => ({ mutateAsync: h.saveSignUpSetting, isPending: h.isPending }),
}));

import { SignupSettings } from "./signup-settings";

describe("SignupSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.settingData = {
      isSignUpEnable: true,
      isEmailPasswordSignUpEnabled: true,
      isSSoSignUpEnabled: false,
      defaultRolesForNewUser: ["role-1"],
      defaultPermissionsForNewUser: ["perm-1"],
      itemId: "item-1",
    };
    h.saveSignUpSetting.mockResolvedValue({ isSuccess: true });
  });

  it("opens the dialog and hydrates checkbox state from settings", async () => {
    render(<SignupSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Signup Settings/ }));
    expect(await screen.findByText("Configure signup settings for users.")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Allow signup" }) as HTMLElement).getAttribute("data-state")).toBe("checked");
    expect((screen.getByRole("checkbox", { name: "Email and password" }) as HTMLElement).getAttribute("data-state")).toBe("checked");
    expect((screen.getByRole("checkbox", { name: "SSO" }) as HTMLElement).getAttribute("data-state")).toBe("unchecked");
  });

  it("toggles a checkbox and saves the derived payload", async () => {
    render(<SignupSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Signup Settings/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "SSO" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.saveSignUpSetting).toHaveBeenCalled());
    const payload = h.saveSignUpSetting.mock.calls[0][0];
    expect(payload).toMatchObject({
      isSignUpEnable: true,
      isEmailPasswordSignUpEnabled: true,
      isSSoSignUpEnabled: true,
      defaultRolesForNewUserOnSignUp: ["role-1"],
      defaultPermissionsForNewUserOnSignUp: ["perm-1"],
      projectKey: "tenant-1",
      itemId: "item-1",
    });
  });

  it("disables the save button while a save is pending", async () => {
    h.isPending = true;
    render(<SignupSettings />);
    fireEvent.click(screen.getByRole("button", { name: /Signup Settings/ }));
    const save = await screen.findByRole("button", { name: "Saving..." });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });
});
