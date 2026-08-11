import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SubscriptionUsagePage } from "./subscription-usage-page";

vi.mock("@/components/ui-kits/dropdown-menu/dropdown-menu", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: Passthrough,
    DropdownMenuTrigger: Passthrough,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
      <div role="menu">{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
    }) => (
      <button role="menuitem" type="button" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

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

  it("opens a time range dropdown and selects a new range", async () => {
    const user = userEvent.setup();
    render(<SubscriptionUsagePage />);
    // default index is 1 -> "Last 30 days"
    const trigger = screen.getByRole("button", { name: /Last 30 days/ });
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: "Last 90 days" }));
    expect(within(trigger).getByText("Last 90 days")).toBeTruthy();
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
    render(<SubscriptionUsagePage />);
    // Credits Used has a 12M limit which fmt renders as "12M".
    const creditsRow = screen.getByText("Credits Used").closest("div")?.parentElement as HTMLElement;
    expect(within(creditsRow).getByText(/12M/)).toBeTruthy();
  });
});
