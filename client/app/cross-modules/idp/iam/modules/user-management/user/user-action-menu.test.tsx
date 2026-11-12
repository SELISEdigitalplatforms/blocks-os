import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "@blocks-idp/iam/hooks/use-grant-scope",
  () => import("@/test-utils/__mocks__/grant-scope.mock"),
);
vi.mock(
  "@blocks-idp/iam/hooks/use-user-manageability",
  () => import("@/test-utils/__mocks__/user-manageability.mock"),
);

// Tooltip re-exports blocks-kit (process.env at load); passthrough keeps it renderable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

// The real hooks and dialogs run against a mocked service, so these tests also count the requests
// the menu causes (spec P1-P3).
const svc = vi.hoisted(() => ({
  getUserById: vi.fn(),
  me: vi.fn(),
  accountDeactivate: vi.fn(),
  accountActivateByAdmin: vi.fn(),
  adminResetPassword: vi.fn(),
  account: { accountResendActivation: vi.fn() },
}));
vi.mock("@blocks-idp/iam/services/user.service", () => ({ userService: svc }));

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (a: unknown) => toasts.success(a),
  showErrorToast: (a: unknown) => toasts.error(a),
  toast: vi.fn(),
}));

import { UserActionMenu } from "./user-action-menu";
import { manageability, resetManageability } from "@/test-utils/__mocks__/user-manageability.mock";

type TestUser = {
  itemId: string;
  active: boolean;
  isVerified?: boolean;
  accountState?: string;
};

const userRecord = (overrides: Partial<TestUser> = {}) => ({
  data: { itemId: "u1", active: true, isVerified: true, accountState: "Active", ...overrides },
});

const renderMenu = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <UserActionMenu id="u1" projectKey="tenant-1" />
    </QueryClientProvider>,
  );
};

const trigger = () => screen.findByRole("button", { name: "More actions" });

// The loading state renders its own disabled button, so wait for the enabled one and use that.
const enabledTrigger = async () => {
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "More actions" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  return screen.getByRole("button", { name: "More actions" });
};

const openMenu = async (user = userEvent.setup()) => {
  await user.click(await enabledTrigger());
  return { user, menu: await screen.findByRole("menu") };
};

const itemNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((item) => item.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  resetManageability();
  svc.getUserById.mockResolvedValue(userRecord());
});

describe("UserActionMenu", () => {
  it("shows one ⋮ trigger instead of the former labelled buttons", async () => {
    renderMenu();
    const button = await trigger();
    expect(button.className).toContain("border");
    expect(button.querySelector("svg")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Reset Password" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resend Activation" })).toBeNull();
  });

  it("offers Reset Password, a separator and a destructive Deactivate account for an active user", async () => {
    renderMenu();
    const { menu } = await openMenu();
    expect(itemNames(menu)).toEqual(["Reset Password", "Deactivate account"]);
    const separator = within(menu).getByRole("separator");
    const [reset, deactivate] = within(menu).getAllByRole("menuitem");
    expect(reset.nextElementSibling).toBe(separator);
    expect(separator.nextElementSibling).toBe(deactivate);
    expect(deactivate.className).toContain("text-destructive");
  });

  it.each(["Deactivated", "Suspended"])("offers only Activate account when %s", async (state) => {
    svc.getUserById.mockResolvedValue(userRecord({ active: false, accountState: state }));
    renderMenu();
    const { menu } = await openMenu();
    expect(itemNames(menu)).toEqual(["Activate account"]);
  });

  it("offers only Resend Activation for an invitation never accepted", async () => {
    svc.getUserById.mockResolvedValue(
      userRecord({ active: false, isVerified: false, accountState: "PendingVerification" }),
    );
    renderMenu();
    const { menu } = await openMenu();
    expect(itemNames(menu)).toEqual(["Resend Activation"]);
  });

  // A record from an IAM build without accountState falls back to active / isVerified.
  it.each([
    [{ active: true }, ["Reset Password", "Deactivate account"]],
    [{ active: false, isVerified: true }, ["Activate account"]],
    [{ active: false, isVerified: false }, ["Resend Activation"]],
  ])("decides the state without accountState for %j", async (fields, expected) => {
    svc.getUserById.mockResolvedValue({ data: { itemId: "u1", ...fields } });
    renderMenu();
    const { menu } = await openMenu();
    expect(itemNames(menu)).toEqual(expected);
  });

  it("opens the existing reset-password dialog and sends the same body as before", async () => {
    svc.adminResetPassword.mockResolvedValue({ isSuccess: true });
    renderMenu();
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Reset Password" }));
    expect(await screen.findByText("Reset password")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(svc.adminResetPassword).toHaveBeenCalledTimes(1));
    expect(svc.adminResetPassword.mock.calls[0][0]).toEqual({ userId: "u1" });
  });

  it("opens the existing resend-activation dialog and sends the same body as before", async () => {
    svc.getUserById.mockResolvedValue(
      userRecord({ active: false, isVerified: false, accountState: "PendingVerification" }),
    );
    svc.account.accountResendActivation.mockResolvedValue({ isSuccess: true });
    renderMenu();
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Resend Activation" }));
    await user.click(await screen.findByRole("button", { name: "Resend" }));
    await waitFor(() => expect(svc.account.accountResendActivation).toHaveBeenCalledTimes(1));
    expect(svc.account.accountResendActivation.mock.calls[0][0]).toEqual({ userId: "u1" });
  });

  it("opens the menu from the keyboard and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();
    const button = await enabledTrigger();
    button.focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const [first, second] = within(menu).getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(first));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("returns focus to the trigger when a dialog closes", async () => {
    renderMenu();
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Deactivate account" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "More actions" })),
    );
    expect(svc.accountDeactivate).not.toHaveBeenCalled();
  });

  it("issues no request to open the menu or a dialog, and one user read on load", async () => {
    renderMenu();
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Deactivate account" }));
    await screen.findByRole("dialog", { name: "Deactivate account?" });
    expect(svc.getUserById).toHaveBeenCalledTimes(1);
    expect(svc.accountDeactivate).not.toHaveBeenCalled();
    expect(svc.me).not.toHaveBeenCalled();
  });

  it("deactivates with one POST and one re-read, then offers only Activate account", async () => {
    svc.accountDeactivate.mockResolvedValue({ isSuccess: true, errors: null });
    renderMenu();
    const { user } = await openMenu();
    svc.getUserById.mockResolvedValue(userRecord({ active: false, accountState: "Deactivated" }));
    await user.click(screen.getByRole("menuitem", { name: "Deactivate account" }));
    await user.dblClick(await screen.findByRole("button", { name: "Deactivate account" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(svc.accountDeactivate).toHaveBeenCalledTimes(1);
    expect(svc.accountDeactivate.mock.calls[0][0]).toEqual({ userId: "u1" });
    expect(toasts.success).toHaveBeenCalledWith({
      description: "User has been deactivated successfully.",
    });
    await waitFor(() => expect(svc.getUserById).toHaveBeenCalledTimes(2));
    expect(svc.me).not.toHaveBeenCalled();
    const { menu } = await openMenu(user);
    expect(itemNames(menu)).toEqual(["Activate account"]);
  });

  it("keeps showing the server's state when a successful deactivate leaves the user active", async () => {
    svc.accountDeactivate.mockResolvedValue({ isSuccess: true });
    renderMenu();
    const { user } = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Deactivate account" }));
    await user.click(await screen.findByRole("button", { name: "Deactivate account" }));
    await waitFor(() => expect(svc.getUserById).toHaveBeenCalledTimes(2));
    const { menu } = await openMenu(user);
    expect(itemNames(menu)).toEqual(["Reset Password", "Deactivate account"]);
  });

  it("activates with the trimmed reason, then offers Reset Password and Deactivate account", async () => {
    svc.getUserById.mockResolvedValue(userRecord({ active: false, accountState: "Deactivated" }));
    svc.accountActivateByAdmin.mockResolvedValue({ isSuccess: true, itemId: "u1" });
    renderMenu();
    const { user } = await openMenu();
    svc.getUserById.mockResolvedValue(userRecord());
    await user.click(screen.getByRole("menuitem", { name: "Activate account" }));
    await user.type(await screen.findByRole("textbox", { name: "Reason" }), "  Rejoined the team ");
    await user.click(screen.getByRole("button", { name: "Activate account" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(svc.accountActivateByAdmin).toHaveBeenCalledTimes(1);
    expect(svc.accountActivateByAdmin.mock.calls[0][0]).toEqual({
      userId: "u1",
      reason: "Rejoined the team",
    });
    await waitFor(() => expect(svc.getUserById).toHaveBeenCalledTimes(2));
    const { menu } = await openMenu(user);
    expect(itemNames(menu)).toEqual(["Reset Password", "Deactivate account"]);
  });

  it("re-reads the user after a refused activation so the menu matches the server", async () => {
    svc.getUserById.mockResolvedValue(userRecord({ active: false, accountState: "Deactivated" }));
    svc.accountActivateByAdmin.mockRejectedValue({
      status: 400,
      errors: { UserId: "User is already active" },
    });
    renderMenu();
    const { user } = await openMenu();
    svc.getUserById.mockResolvedValue(userRecord());
    await user.click(screen.getByRole("menuitem", { name: "Activate account" }));
    await user.type(await screen.findByRole("textbox", { name: "Reason" }), "stale tab");
    await user.click(screen.getByRole("button", { name: "Activate account" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toasts.error).toHaveBeenCalledWith({ errors: { UserId: "User is already active" } });
    await waitFor(() => expect(svc.getUserById).toHaveBeenCalledTimes(2));
    const { menu } = await openMenu(user);
    expect(itemNames(menu)).toEqual(["Reset Password", "Deactivate account"]);
  });

  it("disables the trigger, without a reason, while the user loads", async () => {
    svc.getUserById.mockReturnValue(new Promise(() => undefined));
    renderMenu();
    expect(((await trigger()) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("disabled-reason")).toBeNull();
  });

  it("disables the trigger, without a reason, when the user could not be read", async () => {
    svc.getUserById.mockRejectedValue(new Error("boom"));
    renderMenu();
    await waitFor(() => expect(svc.getUserById).toHaveBeenCalled());
    const button = (await trigger()) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(true));
    expect(screen.queryByTestId("disabled-reason")).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("disables the trigger with the reason for a user the caller cannot manage", async () => {
    manageability.blockedIds.add("u1");
    renderMenu();
    const reason = await screen.findByTestId("disabled-reason");
    const button = within(reason).getByRole("button", {
      name: "More actions",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(reason.textContent).toContain("You can't manage this user");
  });
});
