import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISettingsSignupConfig } from "@blocks-idp/settings/models/settings.model";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const mutateAsync = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSaveSettingsSignUpSetting: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@blocks-idp/settings/hooks/use-settings-tenant-id", () => ({
  useSettingsTenantId: () => "tenant-1",
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => ({
    data: {
      data: [
        { itemId: "1", name: "Cloud Admin", slug: "cloudadmin" },
        { itemId: "2", name: "Test Deploy", slug: "test_deploy" },
      ],
      totalCount: 2,
    },
  }),
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: () => ({ data: { data: [], totalCount: 0 } }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

const { SignupSettingsForm } = await import(
  "@blocks-idp/settings/components/signup-settings-form"
);
const { SettingsTabActionsProvider, SettingsTabActionsSlot } = await import(
  "@blocks-idp/settings/components/settings-tab-actions"
);

const config: ISettingsSignupConfig = {
  isSignUpEnable: true,
  isEmailPasswordSignUpEnabled: true,
  isSSoSignUpEnabled: true,
  defaultRolesForNewUser: ["cloudadmin"],
  defaultPermissionsForNewUser: [],
};

const renderForm = () =>
  render(
    <SettingsTabActionsProvider>
      <SettingsTabActionsSlot activeTab="signup-settings" />
      <SignupSettingsForm config={config} />
    </SettingsTabActionsProvider>,
  );

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("SignupSettingsForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enables Save once the form is edited", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(saveButton().disabled).toBe(true);

    await user.click(screen.getByRole("switch"));

    expect(saveButton().disabled).toBe(false);
  });

  // resetOptions.keepDirtyValues is merged into explicit reset() calls by react-hook-form, which
  // silently made Reset a no-op on values while still clearing isDirty.
  it("restores the saved config values on Reset", async () => {
    const user = userEvent.setup();
    renderForm();

    const toggle = screen.getByRole("switch");
    await user.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(saveButton().disabled).toBe(true);
  });
});
