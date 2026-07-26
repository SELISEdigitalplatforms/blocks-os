import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SubscriptionUsagePage } from "./subscription-usage-page";

describe("SubscriptionUsagePage", () => {
  it("renders the plan, stats and service sections from the seeded data", () => {
    render(<SubscriptionUsagePage />);
    expect(screen.getByText("Subscription Usage")).toBeTruthy();
    expect(screen.getByText("Enterprise Plan")).toBeTruthy();
    expect(screen.getByText("Manage Package")).toBeTruthy();
    expect(screen.getByText("Services")).toBeTruthy();
    // service cards
    expect(screen.getByText("AI Service")).toBeTruthy();
    expect(screen.getByText("Communication")).toBeTruthy();
  });

  it("cycles the time range label when the range button is clicked", async () => {
    const user = userEvent.setup();
    render(<SubscriptionUsagePage />);
    // default index is 1 -> "Last 30 days"
    const rangeButton = screen.getByText("Last 30 days").closest("button") as HTMLButtonElement;
    expect(rangeButton).toBeTruthy();
    await user.click(rangeButton);
    expect(within(rangeButton).getByText("Last 90 days")).toBeTruthy();
    await user.click(rangeButton);
    expect(within(rangeButton).getByText("This billing cycle")).toBeTruthy();
    // wraps back to the first range
    await user.click(rangeButton);
    expect(within(rangeButton).getByText("Last 7 days")).toBeTruthy();
  });

  it("expands and collapses a usage row's environment breakdown", async () => {
    const user = userEvent.setup();
    render(<SubscriptionUsagePage />);
    expect(screen.queryByText("Environment Breakdown")).toBeNull();

    const [firstExpand] = screen.getAllByLabelText("Expand breakdown");
    await user.click(firstExpand);
    expect(screen.getAllByText("Environment Breakdown").length).toBeGreaterThan(0);

    // the same control now collapses the row
    const collapse = screen.getAllByLabelText("Collapse breakdown")[0];
    await user.click(collapse);
    expect(screen.getAllByLabelText("Expand breakdown").length).toBeGreaterThan(0);
  });

  it("formats large numbers into a millions suffix", async () => {
    const user = userEvent.setup();
    render(<SubscriptionUsagePage />);
    // Credits Used has a 12M limit which fmt renders as "12M".
    const creditsRow = screen.getByText("Credits Used").closest("div")?.parentElement as HTMLElement;
    expect(within(creditsRow).getByText(/12M/)).toBeTruthy();
  });
});
