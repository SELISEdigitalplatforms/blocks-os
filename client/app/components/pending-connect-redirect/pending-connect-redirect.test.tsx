import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { useAuthStore } from "@seliseblocks/genesis-os/store";

const navigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => navigate };
});

const { PendingConnectRedirect } = await import("./pending-connect-redirect");

const setAuthenticated = (value: boolean) =>
  useAuthStore.setState({ isAuthenticated: value } as never);

describe("PendingConnectRedirect", () => {
  beforeEach(() => {
    window.localStorage.clear();
    navigate.mockClear();
  });

  it("redirects to the pending connect request once authenticated", () => {
    window.localStorage.setItem(
      "blocks:pending-integration-request",
      JSON.stringify({ requestId: "req-1", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    );
    setAuthenticated(true);

    render(
      <MemoryRouter>
        <PendingConnectRedirect />
      </MemoryRouter>,
    );

    expect(navigate).toHaveBeenCalledWith("/connect?request=req-1", { replace: true });
  });

  it("does nothing without a pending request", () => {
    setAuthenticated(true);

    render(
      <MemoryRouter>
        <PendingConnectRedirect />
      </MemoryRouter>,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it("does nothing while logged out", () => {
    window.localStorage.setItem(
      "blocks:pending-integration-request",
      JSON.stringify({ requestId: "req-1", expiresAt: new Date(Date.now() + 60_000).toISOString() }),
    );
    setAuthenticated(false);

    render(
      <MemoryRouter>
        <PendingConnectRedirect />
      </MemoryRouter>,
    );

    expect(navigate).not.toHaveBeenCalled();
  });

  it("deletes an expired pending request without redirecting", () => {
    window.localStorage.setItem(
      "blocks:pending-integration-request",
      JSON.stringify({ requestId: "req-1", expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    );
    setAuthenticated(true);

    render(
      <MemoryRouter>
        <PendingConnectRedirect />
      </MemoryRouter>,
    );

    expect(navigate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("blocks:pending-integration-request")).toBeNull();
  });
});
