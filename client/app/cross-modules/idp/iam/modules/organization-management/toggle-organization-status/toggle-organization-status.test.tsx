import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { mutateAsync, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({
    selectedProject: { itemId: "p1", tenantId: "t1" },
  }),
}));

vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useSaveOrganization: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast,
  showSuccessToast,
  showInfoToast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ToggleOrganizationStatus } from "./toggle-organization-status";
import { IOrganization } from "@blocks-idp/iam/models/organization";

const makeOrg = (over: Partial<IOrganization>): IOrganization =>
  ({
    itemId: "org-1",
    name: "Acme",
    isEnable: true,
    createdDate: "",
    lastUpdatedDate: "",
    createdBy: "",
    lastUpdatedBy: "",
    language: null,
    organizationIds: [],
    tags: [],
    ...over,
  }) as IOrganization;

const renderDialog = (org: IOrganization, onClose = vi.fn()) => {
  render(
    <Dialog open onOpenChange={() => {}}>
      <ToggleOrganizationStatus organization={org} onClose={onClose} />
    </Dialog>,
  );
  return onClose;
};

describe("ToggleOrganizationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the disable confirmation for an enabled organization", () => {
    renderDialog(makeOrg({ isEnable: true }));
    expect(screen.getByText("Disable Organization")).toBeTruthy();
    expect(
      screen.getByText(/Are you sure you want to disable the organization/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disable" })).toBeTruthy();
  });

  it("renders the enable confirmation for a disabled organization", () => {
    renderDialog(makeOrg({ isEnable: false }));
    expect(screen.getByText("Enable Organization")).toBeTruthy();
    expect(
      screen.getByText(/Are you sure you want to enable the organization/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable" })).toBeTruthy();
  });

  it("calls the mutation and closes on success", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    const onClose = renderDialog(makeOrg({ isEnable: true, name: "Acme" }));

    await user.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        projectKey: "t1",
        name: "Acme",
        itemId: "org-1",
        isEnable: false,
      }),
    );
    expect(showSuccessToast).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it("shows an error toast and keeps the dialog open on failure", async () => {
    mutateAsync.mockResolvedValueOnce({
      isSuccess: false,
      errors: { foo: "bar" },
    });
    const user = userEvent.setup();
    const onClose = renderDialog(makeOrg({ isEnable: true }));

    await user.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
