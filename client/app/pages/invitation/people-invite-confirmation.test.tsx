import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  navigate: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => h.navigate };
});
vi.mock("@/hooks/use-people", () => ({
  usePeopleAcceptInvitation: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));

import { PeopleInviteConfirmation } from "./people-invite-confirmation";

const renderConfirmation = () =>
  render(
    <MemoryRouter>
      <PeopleInviteConfirmation code="invite-code" />
    </MemoryRouter>,
  );

describe("PeopleInviteConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
  });

  it("renders the accept invitation card", () => {
    renderConfirmation();
    expect(screen.getByText("Accept Invitation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });

  it("navigates to the activation flow when an activation key is returned", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true, activationKey: "act-1" });
    renderConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
    const target = h.navigate.mock.calls[0][0] as string;
    expect(target).toContain("success=1");
    expect(target).toContain("act-1");
  });

  it("navigates to the already-member result when no activation key is returned", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: true, activationKey: "" });
    renderConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
    const target = h.navigate.mock.calls[0][0] as string;
    expect(target).toContain("success=1");
    expect(target).toContain("old=1");
  });

  it("routes to the expired result when the code is expired", async () => {
    h.mutateAsync.mockResolvedValue({ isSuccess: false, errors: { code_expire: "expired" } });
    renderConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
    const target = h.navigate.mock.calls[0][0] as string;
    expect(target).toContain("success=0");
    expect(target).toContain("expired");
  });

  it("routes to an unknown-error result when the request throws", async () => {
    h.mutateAsync.mockRejectedValue(new Error("boom"));
    renderConfirmation();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
    const target = h.navigate.mock.calls[0][0] as string;
    expect(target).toContain("success=0");
    expect(target).toContain("unknown");
  });
});
