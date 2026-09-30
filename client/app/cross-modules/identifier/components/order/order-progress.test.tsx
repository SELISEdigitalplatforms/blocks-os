import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderProgress } from "./order-progress";
import { OrderNotificationBell } from "./order-notification-bell";
import { IOrderView } from "@blocks-identifier/models/billing.model";

/**
 * After the charge the customer is never shown a failure. These assert that, because it is the
 * rule most easily lost the next time somebody adds a state.
 */
const order = (overrides: Partial<IOrderView> = {}): IOrderView => ({
  orderId: "ord_1",
  state: "creating",
  total: 1032.4,
  market: "CHF",
  stepsDone: 20,
  stepsTotal: 42,
  currentStep: "Installing certificates",
  currentEnvironment: "Integration",
  attempt: 0,
  maxAttempts: 5,
  declineReason: "",
  chargedAtUtc: null,
  completedAtUtc: null,
  environments: [
    { tenantId: "t1", environment: "dev", stepsDone: 6, stepsTotal: 6, step: "", status: "ready", attempt: 0 },
    { tenantId: "t2", environment: "stg", stepsDone: 3, stepsTotal: 6, step: "Applying configuration", status: "retrying", attempt: 3 },
    { tenantId: "t3", environment: "prod", stepsDone: 0, stepsTotal: 6, step: "", status: "queued", attempt: 0 },
  ],
  ...overrides,
});

describe("OrderProgress", () => {
  it("counts steps rather than environments, because that is what moves", () => {
    render(<OrderProgress order={order()} />);

    expect(screen.getByText("20 of 42 steps")).toBeTruthy();
    expect(screen.getByText("Integration — Installing certificates")).toBeTruthy();
  });

  it("names the step in plain words, never the internal flag", () => {
    render(<OrderProgress order={order()} />);

    expect(screen.getByText(/Applying configuration/)).toBeTruthy();
    expect(screen.queryByText(/IsDefaultConfigurationCopied/)).toBeNull();
  });

  it("shows a retry as an attempt count, not as a failure", () => {
    render(<OrderProgress order={order({ attempt: 3 })} />);

    expect(screen.getAllByText(/attempt 3 of 5/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it("promises no finish time", () => {
    const { container } = render(<OrderProgress order={order()} />);

    // A wrong estimate is worse than none, and this job's length genuinely varies.
    expect(container.textContent).not.toMatch(/remaining|left|eta|minutes? to go/i);
  });

  it("never says the purchase failed once money has moved", () => {
    const { container } = render(<OrderProgress order={order({ state: "paid" })} />);

    expect(container.textContent).not.toMatch(/failed|error|problem/i);
    expect(container.textContent).toMatch(/You can close this page/i);
  });
});

describe("OrderNotificationBell", () => {
  it("shows a single badge for a purchase in flight", () => {
    render(<OrderNotificationBell order={order()} />);

    // One entry per purchase, not one per step.
    expect(screen.getByLabelText(/one in progress/i)).toBeTruthy();
  });

  it("carries no badge once the project is ready", () => {
    render(<OrderNotificationBell order={order({ state: "created" })} />);

    expect(screen.queryByLabelText(/one in progress/i)).toBeNull();
  });
});
