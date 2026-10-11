import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OrderProgress, describeOrder, formatElapsed } from "./order-progress";
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
  currentEnvironment: "iat",
  attempt: 0,
  maxAttempts: 5,
  declineReason: "",
  chargedAtUtc: null,
  completedAtUtc: null,
  environments: [
    {
      tenantId: "t1",
      environment: "dev",
      stepsDone: 6,
      stepsTotal: 6,
      step: "",
      status: "ready",
      attempt: 0,
    },
    {
      tenantId: "t2",
      environment: "stg",
      stepsDone: 3,
      stepsTotal: 6,
      step: "Applying configuration",
      status: "retrying",
      attempt: 3,
    },
    {
      tenantId: "t3",
      environment: "prod",
      stepsDone: 0,
      stepsTotal: 6,
      step: "",
      status: "queued",
      attempt: 0,
    },
  ],
  ...overrides,
});

const calm = (o: Partial<IOrderView> = {}) =>
  order({
    environments: [
      {
        tenantId: "t1",
        environment: "dev",
        stepsDone: 6,
        stepsTotal: 6,
        step: "",
        status: "ready",
        attempt: 0,
      },
      {
        tenantId: "t3",
        environment: "prod",
        stepsDone: 2,
        stepsTotal: 6,
        step: "Installing certificates",
        status: "building",
        attempt: 0,
      },
    ],
    ...o,
  });

describe("OrderProgress", () => {
  it("counts steps rather than environments, and names environments by their label", () => {
    render(<OrderProgress order={order()} labels={{ iat: "Integration acceptance" }} />);
    expect(screen.getByText("20 of 42")).toBeTruthy();
    expect(screen.getByText("Integration acceptance — Installing certificates")).toBeTruthy();
  });

  it("names the step in plain words, never the internal flag", () => {
    render(<OrderProgress order={order()} />);
    expect(screen.getAllByText(/Applying configuration/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/IsDefaultConfigurationCopied/)).toBeNull();
  });

  it("shows a retry as an attempt count, not as a failure", () => {
    render(<OrderProgress order={order()} />);
    expect(screen.getAllByText(/attempt 3 of 5/).length).toBeGreaterThan(0);
    expect(screen.getByText("One step is taking a few goes.")).toBeTruthy();
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it("promises no finish time", () => {
    const { container } = render(<OrderProgress order={order()} />);
    // A wrong estimate is worse than none, and this job's length genuinely varies.
    expect(container.textContent).not.toMatch(/remaining|eta|minutes? to go|estimated/i);
  });

  it("never says the purchase failed once money has moved", () => {
    const { container } = render(<OrderProgress order={calm({ state: "paid" })} />);
    expect(container.textContent).not.toMatch(/failed|error|problem/i);
    expect(container.textContent).toMatch(/You can close this page/i);
  });
});

describe("describeOrder", () => {
  it("covers every state without a failure after payment", () => {
    expect(describeOrder(calm({ state: "paid", stepsDone: 0 })).headline).toBe("Payment received");
    expect(describeOrder(calm()).subline).toBe("1 of 2 are ready.");
    expect(describeOrder(order({ attempt: 5 })).headline).toBe("Still working on it");
    expect(describeOrder(order({ attempt: 5 })).tone).toBe("warn");
    expect(describeOrder(calm({ state: "created" }), "Northwind").headline).toBe(
      "Northwind is ready",
    );
    expect(describeOrder(calm({ state: "pending" })).headline).toBe("Confirming your payment");
    for (const state of ["paid", "creating", "created", "pending"]) {
      const copy = describeOrder(order({ state, attempt: 5 }));
      expect(`${copy.headline} ${copy.subline} ${copy.notice}`).not.toMatch(/fail|error/i);
    }
  });

  it("a decline is the one failure shown, and it says nothing was charged", () => {
    const copy = describeOrder(order({ state: "declined" }));
    expect(copy.tone).toBe("bad");
    expect(copy.subline).toMatch(/not been charged/);
    expect(copy.building).toBe(false);
  });
});

describe("formatElapsed", () => {
  it("counts up from the charge", () => {
    const start = "2026-10-11T10:00:00Z";
    expect(formatElapsed(start, new Date("2026-10-11T10:04:36Z").getTime())).toBe("4:36");
    expect(formatElapsed(start, new Date("2026-10-11T11:02:10Z").getTime())).toBe("1:02:10");
    expect(formatElapsed(null, Date.now())).toBe("");
  });
});

describe("OrderNotificationBell", () => {
  it("one entry per purchase, counted in the badge", async () => {
    const user = userEvent.setup();
    render(<OrderNotificationBell orders={[order(), order({ orderId: "ord_2" })]} />);
    expect(screen.getByLabelText("Notifications, 2 in progress")).toBeTruthy();
    await user.click(screen.getByRole("button"));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("carries no badge once the project is ready", () => {
    render(<OrderNotificationBell orders={[order({ state: "created" })]} />);
    expect(screen.queryByLabelText(/in progress/i)).toBeNull();
  });
});
