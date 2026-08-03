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

const mutateAsync = vi.fn();
const showErrorToast = vi.fn();
const showSuccessToast = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/authentication/hooks/use-sso", () => ({
  useUpdateSsoCredentialStatus: () => ({ mutateAsync }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...args: unknown[]) => showErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => showSuccessToast(...args),
}));

const { SSoProviderStatusToggle } = await import("./sso-provider-status-toggle");

type Config = Parameters<typeof SSoProviderStatusToggle>[0]["configuration"];

const makeConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    itemId: "cfg-1",
    provider: "google",
    label: "Google",
    isDisabled: false,
    ...overrides,
  }) as Config;

describe("SSoProviderStatusToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the disable confirmation for an active provider", () => {
    render(
      <SSoProviderStatusToggle
        open
        setOpen={vi.fn()}
        configuration={makeConfig({ isDisabled: false })}
      />,
    );

    expect(screen.getByText("Disable")).toBeTruthy();
    expect(
      screen.getByText(
        "Are you sure you want to disable this provider? Users will no longer be able to sign in using it.",
      ),
    ).toBeTruthy();
  });

  it("shows the enable confirmation for a disabled provider", () => {
    render(
      <SSoProviderStatusToggle
        open
        setOpen={vi.fn()}
        configuration={makeConfig({ isDisabled: true })}
      />,
    );

    expect(screen.getByText("Enable")).toBeTruthy();
    expect(
      screen.getByText(
        "Are you sure you want to enable this provider? It will be available for user sign-in.",
      ),
    ).toBeTruthy();
  });

  it("calls the status mutation and closes on confirm", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    mutateAsync.mockResolvedValue({ isSuccess: true });

    render(
      <SSoProviderStatusToggle
        open
        setOpen={setOpen}
        configuration={makeConfig({ isDisabled: false })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        itemId: "cfg-1",
        projectKey: "tenant-1",
        isEnabled: true,
      });
    });
    await waitFor(() => {
      expect(showSuccessToast).toHaveBeenCalled();
      expect(setOpen).toHaveBeenCalledWith(false);
    });
  });

  it("surfaces an error toast when the mutation reports failure", async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ isSuccess: false, errors: "nope" });

    render(
      <SSoProviderStatusToggle
        open
        setOpen={vi.fn()}
        configuration={makeConfig({ isDisabled: true })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "nope" });
    });
    expect(showSuccessToast).not.toHaveBeenCalled();
  });
});
