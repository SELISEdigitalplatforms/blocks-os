import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  reset: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useCreateSignupLinkConfiguration: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isPending,
    reset: h.reset,
  }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: () => ({ data: { data: [{ name: "Partner", slug: "partner-user" }] } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: () => ({ data: { data: [] } }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    MultiSelect: ({
      label,
      value,
      onChange,
    }: {
      label?: string;
      value: string[];
      onChange: (v: string[]) => void;
    }) => (
      <button type="button" onClick={() => onChange([...(value || []), "partner-user"])}>
        {label}
      </button>
    ),
  },
}));

import { AddConfiguration } from "./add-configuration";

describe("AddConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "new-1" });
  });

  it("blocks empty submit client-side with no network call", async () => {
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(h.mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findByText("Name is required")).toBeTruthy();
  });

  it("creates a configuration and toasts success", async () => {
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
    await user.type(screen.getByPlaceholderText("OIDC client id"), "partner-portal");
    await user.type(
      screen.getByPlaceholderText("https://example.com/callback"),
      "https://partner.example.com/callback",
    );
    await user.click(screen.getByRole("button", { name: "Roles" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Partner onboarding",
        clientId: "partner-portal",
        redirectUri: "https://partner.example.com/callback",
        credentialMode: "Passwordless",
        defaultLifetimeMinutes: 1440,
        defaultRoles: ["partner-user"],
      }),
    );
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Configuration created" });
  });

  it("keeps the dialog open and maps a 400 Name error onto the field", async () => {
    h.mutateAsync.mockRejectedValue({
      status: 400,
      errors: { Name: "A configuration with this name already exists" },
    });
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
    await user.type(screen.getByPlaceholderText("OIDC client id"), "partner-portal");
    await user.type(
      screen.getByPlaceholderText("https://example.com/callback"),
      "https://partner.example.com/callback",
    );
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("A configuration with this name already exists"),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add Configuration" })).toBeTruthy();
    expect(h.showSuccessToast).not.toHaveBeenCalled();
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("surfaces unmapped 400 keys as a form-level error", async () => {
    h.mutateAsync.mockRejectedValue({
      status: 400,
      errors: { SomethingElse: "Unexpected rejection" },
    });
    const user = userEvent.setup();
    render(<AddConfiguration />);
    await user.click(screen.getByRole("button", { name: "Add Configuration" }));
    await user.type(screen.getByPlaceholderText("Partner onboarding"), "Partner onboarding");
    await user.type(screen.getByPlaceholderText("OIDC client id"), "partner-portal");
    await user.type(
      screen.getByPlaceholderText("https://example.com/callback"),
      "https://partner.example.com/callback",
    );
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect((await screen.findByTestId("form-level-error")).textContent).toContain("Unexpected rejection");
  });
});
