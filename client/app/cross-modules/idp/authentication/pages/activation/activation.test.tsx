import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  validate: vi.fn(),
  isActivationPending: false,
  resend: vi.fn(),
  isResendPending: false,
}));

vi.mock("@blocks-idp/iam/hooks/use-account", () => ({
  useAccountActivationCodeExpiration: () => ({
    mutateAsync: h.validate,
    isPending: h.isActivationPending,
  }),
  useAccountResendActivation: () => ({
    mutateAsync: h.resend,
    isPending: h.isResendPending,
  }),
}));
vi.mock("@/components/logo", () => ({ Logo: () => <div data-testid="logo" /> }));
vi.mock("./activation-form", () => ({
  ActivationForm: ({ code }: { code: string }) => (
    <div data-testid="activation-form">{code}</div>
  ),
}));

import { Activation } from "./activation";

const renderComponent = (props: { code?: string } = {}) =>
  render(
    <MemoryRouter>
      <Activation {...props} />
    </MemoryRouter>,
  );

describe("Activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isActivationPending = false;
    h.isResendPending = false;
    h.validate.mockResolvedValue({ isSuccess: true });
    h.resend.mockResolvedValue({ isSuccess: true });
  });

  it("shows the invalid screen immediately when no code is supplied", async () => {
    renderComponent({});
    expect(await screen.findByText("Invalid Activation Link")).toBeTruthy();
    expect(h.validate).not.toHaveBeenCalled();
  });

  it("renders the validating placeholder while the request is pending", () => {
    h.isActivationPending = true;
    renderComponent({ code: "abc" });
    expect(screen.getByText("Validating activation code...")).toBeTruthy();
  });

  it("renders the activation form when the code is valid and pending", async () => {
    renderComponent({ code: "valid-code" });
    const form = await screen.findByTestId("activation-form");
    expect(form.textContent).toBe("valid-code");
    expect(h.validate).toHaveBeenCalledWith(
      expect.objectContaining({ activationCode: "valid-code" }),
    );
  });

  it("shows the already-active screen from a structured status", async () => {
    h.validate.mockResolvedValue({ isSuccess: false, status: "already_activated" });
    renderComponent({ code: "used" });
    expect(await screen.findByText("Your account is already active")).toBeTruthy();
  });

  it("shows the already-active screen when errors carry the already-activated signal", async () => {
    h.validate.mockResolvedValue({ isSuccess: false, errors: { message: "Already activated" } });
    renderComponent({ code: "used" });
    expect(await screen.findByText("Your account is already active")).toBeTruthy();
  });

  it("shows the invalid screen when the response carries generic errors", async () => {
    h.validate.mockResolvedValue({ isSuccess: false, errors: { general: "bad code" } });
    renderComponent({ code: "broken" });
    expect(await screen.findByText("Invalid Activation Link")).toBeTruthy();
  });

  it("shows the expired screen and resends a new link on success", async () => {
    const user = userEvent.setup();
    h.validate.mockResolvedValue({ isSuccess: false, userId: "user-1" });
    renderComponent({ code: "expired" });
    expect(await screen.findByText("Activation Link Expired")).toBeTruthy();
    const resendBtn = screen.getByRole("button", { name: "Resend activation link" });
    await user.click(resendBtn);
    await waitFor(() =>
      expect(h.resend).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1" })),
    );
    expect(
      await screen.findByText("A new activation link has been sent to your email."),
    ).toBeTruthy();
  });

  it("reports a failure message when the resend response is not successful", async () => {
    const user = userEvent.setup();
    h.validate.mockResolvedValue({ isSuccess: false, userId: "user-1" });
    h.resend.mockResolvedValue({ isSuccess: false });
    renderComponent({ code: "expired" });
    await screen.findByText("Activation Link Expired");
    await user.click(screen.getByRole("button", { name: "Resend activation link" }));
    expect(
      await screen.findByText("Failed to resend activation link. Please try again later."),
    ).toBeTruthy();
  });

  it("reports the error message when the resend call throws", async () => {
    const user = userEvent.setup();
    h.validate.mockResolvedValue({ isSuccess: false, userId: "user-1" });
    h.resend.mockRejectedValue(new Error("network down"));
    renderComponent({ code: "expired" });
    await screen.findByText("Activation Link Expired");
    await user.click(screen.getByRole("button", { name: "Resend activation link" }));
    expect(await screen.findByText("network down")).toBeTruthy();
  });

  it("routes a thrown already-activated error to the already-active screen", async () => {
    h.validate.mockRejectedValue({ errors: { detail: "account already sign-in enabled" } });
    renderComponent({ code: "used" });
    expect(await screen.findByText("Your account is already active")).toBeTruthy();
  });

  it("falls back to the invalid screen when the request throws a generic error", async () => {
    h.validate.mockRejectedValue({ errors: { general: "boom" } });
    renderComponent({ code: "broken" });
    expect(await screen.findByText("Invalid Activation Link")).toBeTruthy();
  });
});
