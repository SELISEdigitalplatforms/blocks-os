import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { aiCreditsService } from "../../services/ai-credits.service";
import { mockCheckoutTopUp, mockPaidTopUp, mockUsage, refusal } from "../../test-utils/__mocks__";
import { AiCreditsPage } from "./ai-credits-page";

vi.mock("../../services/ai-credits.service", () => ({
  aiCreditsService: { getUsage: vi.fn(), createTopUp: vi.fn() },
}));

const renderPage = () => render(<AiCreditsPage />, { wrapper: createWrapper() });

const codeInput = () => document.querySelector("input[data-input-otp]") as HTMLInputElement;

describe("AiCreditsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiCreditsService.getUsage).mockResolvedValue(mockUsage);
  });

  it("shows the balance, both pools, the expiries and the last top-up", async () => {
    renderPage();

    expect(await screen.findByText("6,360")).toBeTruthy();
    expect(screen.getByText("Agents can run")).toBeTruthy();
    expect(screen.getByText("Free credits")).toBeTruthy();
    expect(screen.getByText("Coupon credits")).toBeTruthy();
    expect(screen.getByText("2,300")).toBeTruthy();
    expect(screen.getByText("11 Oct 2026 · 2,500 credits")).toBeTruthy();
  });

  it("says no credits are left when agents are blocked", async () => {
    vi.mocked(aiCreditsService.getUsage).mockResolvedValue({
      ...mockUsage,
      allowed: false,
      remaining: 0,
    });
    renderPage();

    expect(await screen.findByText("No credits left")).toBeTruthy();
  });

  it("hides the coupon form from a caller who may not pay", async () => {
    vi.mocked(aiCreditsService.getUsage).mockResolvedValue({ ...mockUsage, canTopUp: false });
    renderPage();

    expect(await screen.findByText("Only a project admin can redeem coupons.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Redeem" })).toBeNull();
  });

  it("refuses a short code without calling the server", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "zjw");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect(screen.getByRole("alert").textContent).toContain("Enter all 8 characters of the code.");
    expect(aiCreditsService.createTopUp).not.toHaveBeenCalled();
  });

  it("redeems the flat upper-case code and shows the credits granted", async () => {
    vi.mocked(aiCreditsService.createTopUp).mockResolvedValue(mockPaidTopUp);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "zjwlgq7y");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => expect(aiCreditsService.createTopUp).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(aiCreditsService.createTopUp).mock.calls[0][0];
    expect(payload.couponCode).toBe("ZJWLGQ7Y");
    expect(payload.amountChf).toBe(25);
    expect(payload.requestId.length).toBeGreaterThanOrEqual(8);
    expect((await screen.findByRole("status")).textContent).toContain(
      "2,500 credits added. Coupon ZJWL-GQ7Y is redeemed. The credits are valid until 27 Oct 2026.",
    );
  });

  it("shows the server's coupon refusal under the field", async () => {
    vi.mocked(aiCreditsService.createTopUp).mockRejectedValue(refusal(409, "coupon_expired"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "EXPD2026");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect((await screen.findByRole("alert")).textContent).toContain("This coupon has expired.");
  });

  it("never opens checkout when the coupon leaves something to pay", async () => {
    vi.mocked(aiCreditsService.createTopUp).mockResolvedValue(mockCheckoutTopUp);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "HALF0001");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "This coupon does not cover the full amount.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers a retry when the usage cannot be read", async () => {
    vi.mocked(aiCreditsService.getUsage).mockRejectedValue(new Error("down"));
    renderPage();

    expect(
      await screen.findByText("We could not load the AI credits for this project."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
