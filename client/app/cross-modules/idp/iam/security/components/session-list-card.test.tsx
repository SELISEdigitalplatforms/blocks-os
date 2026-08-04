import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  sessions: {} as Record<string, unknown>,
  revoke: vi.fn(),
  isPending: false,
  refetch: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (a: unknown) => h.showError(a),
  showSuccessToast: (a: unknown) => h.showSuccess(a),
}));
vi.mock("@blocks-idp/iam/utils/device-icon", () => ({
  getDeviceIcon: () => () => <svg data-testid="device-icon" />,
}));
vi.mock("../hooks", () => ({
  useUserSessions: () => h.sessions,
  useRevokeSession: () => ({ mutateAsync: h.revoke, isPending: h.isPending }),
}));
vi.mock("../mappers/session.mapper", () => ({
  toSessionCardViewModel: (raw: Record<string, unknown>) => raw,
}));
vi.mock("./session-details-drawer", () => ({
  SessionDetailsDrawer: ({
    sessionId,
    onOpenChange,
    onRevoked,
  }: {
    sessionId: string | null;
    onOpenChange: (open: boolean) => void;
    onRevoked: () => void;
  }) => (
    <div data-testid="details-drawer">
      <span data-testid="drawer-session">{sessionId ?? "none"}</span>
      <button data-testid="drawer-close" onClick={() => onOpenChange(false)}>
        close
      </button>
      <button data-testid="drawer-keep-open" onClick={() => onOpenChange(true)}>
        keep open
      </button>
      <button data-testid="drawer-revoked" onClick={onRevoked}>
        revoked
      </button>
    </div>
  ),
}));

import { SessionListCard } from "./session-list-card";

const card = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  deviceName: "MacBook",
  browser: "Chrome",
  operatingSystem: "macOS",
  applicationSummary: "IAM",
  ipAddress: "1.2.3.4",
  lastActivityDisplay: "just now",
  isCurrent: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
  h.sessions = { isLoading: false, isFetching: false, data: [card()], refetch: h.refetch };
});

describe("SessionListCard", () => {
  it("renders the loading skeleton while sessions load", () => {
    h.sessions = { isLoading: true, isFetching: false, data: undefined, refetch: h.refetch };
    const { container } = render(<SessionListCard userId="u1" />);
    expect(container.querySelector(".grid")).not.toBeNull();
  });

  it("renders the empty state when there are no sessions", () => {
    h.sessions = { isLoading: false, isFetching: false, data: [], refetch: h.refetch };
    render(<SessionListCard userId="u1" />);
    expect(screen.getByText("No sessions")).toBeTruthy();
  });

  it("renders a row per session", () => {
    render(<SessionListCard userId="u1" />);
    expect(screen.getByText("MacBook")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("marks the current device and omits its sign-out button", () => {
    h.sessions = { isLoading: false, isFetching: false, data: [card({ isCurrent: true })], refetch: h.refetch };
    render(<SessionListCard userId="u1" />);
    expect(screen.getByText("This device")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("signs out a device and shows a success toast", async () => {
    h.revoke.mockResolvedValue(undefined);
    render(<SessionListCard userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy(),
    );
    const confirmButtons = screen.getAllByRole("button", { name: "Sign out" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() => expect(h.revoke).toHaveBeenCalledWith({ sessionId: "s1" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalled());
    expect(h.refetch).toHaveBeenCalled();
  });

  const openConfirmDialog = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByText("Sign out of this device?");
    const buttons = screen.getAllByRole("button", { name: "Sign out" });
    return buttons[buttons.length - 1];
  };

  it("surfaces the server errors when signing out fails", async () => {
    h.revoke.mockRejectedValue({ errors: { session: "already revoked" } });
    render(<SessionListCard userId="u1" />);
    fireEvent.click(await openConfirmDialog());
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith({ errors: { session: "already revoked" } }),
    );
    expect(h.showSuccess).not.toHaveBeenCalled();
  });

  it("shows a generic error toast when signing out throws a plain error", async () => {
    h.revoke.mockRejectedValue("boom");
    render(<SessionListCard userId="u1" />);
    fireEvent.click(await openConfirmDialog());
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("closes the confirmation without revoking when Cancel is pressed", async () => {
    render(<SessionListCard userId="u1" />);
    await openConfirmDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByText("Sign out of this device?")).toBeNull(),
    );
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it("disables the confirm button while the revoke request is pending", async () => {
    h.isPending = true;
    render(<SessionListCard userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const confirm = await screen.findByRole("button", { name: "Signing out..." });
    expect(confirm).toHaveProperty("disabled", true);
  });

  it("opens the details drawer for the clicked session", () => {
    render(<SessionListCard userId="u1" />);
    expect(screen.getByTestId("drawer-session").textContent).toBe("none");
    fireEvent.click(screen.getByText("MacBook"));
    expect(screen.getByTestId("drawer-session").textContent).toBe("s1");
  });

  it("clears the selected session only when the drawer reports it closed", () => {
    render(<SessionListCard userId="u1" />);
    fireEvent.click(screen.getByText("MacBook"));

    fireEvent.click(screen.getByTestId("drawer-keep-open"));
    expect(screen.getByTestId("drawer-session").textContent).toBe("s1");

    fireEvent.click(screen.getByTestId("drawer-close"));
    expect(screen.getByTestId("drawer-session").textContent).toBe("none");
  });

  it("refetches the sessions when the drawer revokes one", () => {
    render(<SessionListCard userId="u1" />);
    fireEvent.click(screen.getByTestId("drawer-revoked"));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });
});
