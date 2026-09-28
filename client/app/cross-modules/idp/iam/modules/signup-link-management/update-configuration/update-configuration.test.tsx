import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";

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
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useUpdateSignupLinkConfiguration: () => ({
    mutateAsync: h.mutateAsync,
    isPending: h.isPending,
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
  useGetRoles: () => ({ data: { data: [] } }),
}));

vi.mock("@blocks-idp/iam/hooks/use-permission", () => ({
  useGetPermissions: () => ({ data: { data: [] } }),
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterControls: {
    MultiSelect: () => <div data-testid="multi" />,
  },
}));

import { UpdateConfiguration } from "./update-configuration";
import { ISignupLinkConfiguration } from "@blocks-idp/iam/models/signup-link-configuration";

const configuration: ISignupLinkConfiguration = {
  itemId: "cfg-1",
  name: "Partner onboarding",
  description: "old",
  defaultRoles: ["partner-user"],
  defaultPermissions: [],
  clientId: "partner-portal",
  redirectUri: "https://partner.example.com/callback",
  defaultForwardedTo: null,
  credentialMode: "Passwordless",
  defaultLifetimeMinutes: 1440,
  defaultMaxRedemptions: null,
  isActive: true,
  createdDate: "2026-01-01T00:00:00Z",
  lastUpdatedDate: "2026-01-01T00:00:00Z",
};

describe("UpdateConfiguration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "cfg-1" });
  });

  it("PATCHes only the changed description field", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open>
        <UpdateConfiguration configuration={configuration} isOpen onClose={onClose} />
      </Dialog>,
    );

    const description = screen.getByPlaceholderText("Optional description");
    await user.clear(description);
    await user.type(description, "new description only");
    await user.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({
      itemId: "cfg-1",
      description: "new description only",
    });
    expect(h.showSuccessToast).toHaveBeenCalledWith({ description: "Configuration updated" });
    expect(onClose).toHaveBeenCalled();
  });
});

  it("keeps dialog open on 400 field errors", async () => {
    h.mutateAsync.mockRejectedValue({
      status: 400,
      errors: { Name: "taken" },
    });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open>
        <UpdateConfiguration configuration={configuration} isOpen onClose={onClose} />
      </Dialog>,
    );
    const description = screen.getByPlaceholderText("Optional description");
    await user.clear(description);
    await user.type(description, "x");
    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(await screen.findByText("taken")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("toasts and closes on 404", async () => {
    h.mutateAsync.mockRejectedValue({ status: 404 });
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog open>
        <UpdateConfiguration configuration={configuration} isOpen onClose={onClose} />
      </Dialog>,
    );
    const description = screen.getByPlaceholderText("Optional description");
    await user.clear(description);
    await user.type(description, "x");
    await user.click(screen.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });
