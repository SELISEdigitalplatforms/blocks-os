import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { aiCreditsService } from "../../services/ai-credits.service";
import { mockRedeemedCoupon, mockUsage, refusal } from "../../test-utils/__mocks__";
import { AiCreditsPage } from "./ai-credits-page";

vi.mock("../../services/ai-credits.service", () => ({
  aiCreditsService: { getUsage: vi.fn(), redeemCoupon: vi.fn() },
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

    expect(screen.getByRole("heading", { level: 1, name: "AI Credits" })).toBeTruthy();
    expect(await screen.findByText("6,360")).toBeTruthy();
    expect(screen.getByText("Agents can run")).toBeTruthy();
    expect(screen.getByText("Free credits")).toBeTruthy();
    expect(screen.getByText("Voucher credits")).toBeTruthy();
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

  it("hides the voucher form from a caller who may not pay", async () => {
    vi.mocked(aiCreditsService.getUsage).mockResolvedValue({ ...mockUsage, canTopUp: false });
    renderPage();

    expect(await screen.findByText("Only a project admin can redeem vouchers.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Redeem" })).toBeNull();
  });

  it("refuses a short code without calling the server", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "zjw");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect(screen.getByRole("alert").textContent).toContain("Enter all 8 characters of the code.");
    expect(aiCreditsService.redeemCoupon).not.toHaveBeenCalled();
  });

  it("redeems the flat upper-case code and shows the credits granted", async () => {
    vi.mocked(aiCreditsService.redeemCoupon).mockResolvedValue(mockRedeemedCoupon);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "zjwlgq7y");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() => expect(aiCreditsService.redeemCoupon).toHaveBeenCalledTimes(1));
    expect(aiCreditsService.redeemCoupon).toHaveBeenCalledWith({ couponCode: "ZJWLGQ7Y" });
    expect((await screen.findByRole("status")).textContent).toContain(
      "2,500 credits added. Voucher ZJWL-GQ7Y is redeemed. The credits are valid until 27 Oct 2026.",
    );
  });

  it("shows the server's voucher refusal under the field", async () => {
    vi.mocked(aiCreditsService.redeemCoupon).mockRejectedValue(refusal(409, "coupon_expired"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "EXPD2026");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect((await screen.findByRole("alert")).textContent).toContain("This voucher has expired.");
  });

  it("explains that a discount voucher does not add credits", async () => {
    vi.mocked(aiCreditsService.redeemCoupon).mockRejectedValue(refusal(409, "coupon_lowers_price"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });

    await user.type(codeInput(), "HALF0001");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "This voucher gives a discount on a top-up. It does not add credits here.",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the code and the error", async () => {
    vi.mocked(aiCreditsService.redeemCoupon).mockRejectedValue(refusal(409, "coupon_expired"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("button", { name: "Redeem" });
    const clear = screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement;
    expect(clear.disabled).toBe(true);

    await user.type(codeInput(), "EXPD2026");
    await user.click(screen.getByRole("button", { name: "Redeem" }));
    await screen.findByRole("alert");
    await user.click(clear);

    expect(codeInput().value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(clear.disabled).toBe(true);
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
