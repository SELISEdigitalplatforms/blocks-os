import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getConfig: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("../../hooks/use-mfa-config", () => ({
  useGetMFAConfig: () => h.getConfig(),
  useSaveMFAConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import { ConfigureMFA } from "./configure-mfa";

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>, rowName: RegExp) => {
  const row = screen.getByRole("row", { name: rowName });
  await user.click(within(row).getByRole("button"));
};

describe("ConfigureMFA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.getConfig.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: { allowedMethods: [2] },
    });
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("renders skeletons while the config is loading", () => {
    h.getConfig.mockReturnValue({ isLoading: true, isFetching: false, data: undefined });
    const { container } = render(<ConfigureMFA />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("shows the empty state when no config data is returned", () => {
    h.getConfig.mockReturnValue({ isLoading: false, isFetching: false, data: undefined });
    render(<ConfigureMFA />);
    expect(screen.getByText("No configurations found")).toBeTruthy();
  });

  it("marks the allowed methods as enabled and the rest as disabled", () => {
    render(<ConfigureMFA />);
    expect(within(screen.getByRole("row", { name: /Email/ })).getByText("Enabled")).toBeTruthy();
    expect(
      within(screen.getByRole("row", { name: /Authenticator app/ })).getByText("Disabled"),
    ).toBeTruthy();
  });

  it("disables an enabled method after confirmation", async () => {
    const user = userEvent.setup();
    render(<ConfigureMFA />);

    await openRowMenu(user, /Email/);
    await user.click(await screen.findByRole("menuitem", { name: "Disable" }));

    expect(
      await screen.findByText("Are you sure you want to disable Email MFA?"),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    expect(h.mutateAsync).toHaveBeenCalledWith({ enabled: false, allowedMethods: [] });
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Email MFA disabled successfully",
    });
  });

  it("enables a disabled method after confirmation", async () => {
    const user = userEvent.setup();
    render(<ConfigureMFA />);

    await openRowMenu(user, /Authenticator app/);
    await user.click(await screen.findByRole("menuitem", { name: "Enable" }));

    expect(
      await screen.findByText("Are you sure you want to enable Authenticator app MFA?"),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = h.mutateAsync.mock.calls[0][0];
    expect(payload.enabled).toBe(true);
    expect(payload.allowedMethods).toEqual(expect.arrayContaining([2, 1]));
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Authenticator app MFA enabled successfully",
    });
  });

  it("surfaces a backend error when the save is unsuccessful", async () => {
    const user = userEvent.setup();
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { general: "bad" } });
    render(<ConfigureMFA />);

    await openRowMenu(user, /Email/);
    await user.click(await screen.findByRole("menuitem", { name: "Disable" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: { general: "bad" } }),
    );
  });
});
