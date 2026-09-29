import { render, screen } from "@testing-library/react";
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
  archive: vi.fn(),
  isPending: false,
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useArchiveSignupLinkConfiguration: () => ({
    mutateAsync: h.archive,
    isPending: h.isPending,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => h.successToast(...a),
  showErrorToast: (...a: unknown[]) => h.errorToast(...a),
}));

vi.mock("../add-configuration/add-configuration", () => ({
  AddConfiguration: () => <button type="button">Add Configuration</button>,
}));

vi.mock("../update-configuration/update-configuration", () => ({
  UpdateConfiguration: ({ configuration }: { configuration: { name: string } }) => (
    <div data-testid="update-dialog">Editing {configuration.name}</div>
  ),
}));

import { ConfigurationsList } from "./configurations-list";
import { ISignupLinkConfiguration } from "@blocks-idp/iam/models/signup-link-configuration";

const sample: ISignupLinkConfiguration = {
  itemId: "cfg-1",
  name: "Partner onboarding",
  description: null,
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

describe("ConfigurationsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.archive.mockResolvedValue({ isSuccess: true, itemId: "cfg-1" });
  });

  it("shows the first-run empty state", () => {
    render(
      <ConfigurationsList
        items={[]}
        isLoading={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("No signup link configurations yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Configuration" })).toBeTruthy();
  });

  it("shows no-match empty with clear filters", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfigurationsList
        items={[]}
        isLoading={false}
        hasActiveFilters
        onClearFilters={onClear}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("No configurations match your search.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  it("shows skeletons while loading", () => {
    render(
      <ConfigurationsList
        items={[]}
        isLoading
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("configurations-loading")).toBeTruthy();
  });

  it("renders rows and opens the edit dialog", async () => {
    const user = userEvent.setup();
    render(
      <ConfigurationsList
        items={[sample]}
        isLoading={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Partner onboarding")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Edit configuration Partner onboarding" }));
    expect((screen.getByTestId("update-dialog")).textContent).toContain("Editing Partner onboarding");
  });

  it("archives after confirmation and cancels without calling the API", async () => {
    const user = userEvent.setup();
    render(
      <ConfigurationsList
        items={[sample]}
        isLoading={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Archive configuration Partner onboarding" }),
    );
    expect(screen.getByText("Archive this configuration?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.archive).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Archive configuration Partner onboarding" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(h.archive).toHaveBeenCalledWith("cfg-1");
    expect(h.successToast).toHaveBeenCalledWith({ description: "Configuration archived" });
  });

  it("shows the permission message on 403", () => {
    render(
      <ConfigurationsList
        items={[]}
        isLoading={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(
      screen.getByText("You do not have permission to manage signup link configurations."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add Configuration" })).not.toBeTruthy();
  });

  it("shows error with Retry", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfigurationsList
        items={[]}
        isLoading={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("toasts when archive returns 404", async () => {
    h.archive.mockRejectedValue({ status: 404 });
    const user = userEvent.setup();
    render(
      <ConfigurationsList
        items={[sample]}
        isLoading={false}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Archive configuration Partner onboarding" }),
    );
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(h.errorToast).toHaveBeenCalledWith({
      errors: "This configuration no longer exists.",
    });
  });

  it("shows an Archived badge for inactive rows", () => {
    render(
      <ConfigurationsList
        items={[{ ...sample, isActive: false }]}
        isLoading={false}
        hasActiveFilters
        onClearFilters={vi.fn()}
        isForbidden={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText("Archived")).toBeTruthy();
  });
});
