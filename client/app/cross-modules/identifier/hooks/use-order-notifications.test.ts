import { describe, expect, it } from "vitest";
import { mergeOrderPush, parseOrderPush, useOrderFeed } from "./use-order-notifications";

const payload = {
  orderId: "ord-1",
  tenantGroupId: "grp-1",
  state: "creating",
  stepsDone: 3,
  stepsTotal: 12,
  currentStep: "Installing certificates",
  currentEnvironment: "prod",
  attempt: 1,
  maxAttempts: 5,
  environments: [],
};

describe("parseOrderPush", () => {
  it("reads the blocks-logic envelope, string or object", () => {
    expect(
      parseOrderPush(JSON.stringify({ denormalizedPayload: JSON.stringify(payload) }))?.orderId,
    ).toBe("ord-1");
    expect(parseOrderPush({ denormalizedPayload: payload })?.stepsDone).toBe(3);
  });

  it("camel-cases the nested environment rows", () => {
    const push = parseOrderPush({
      denormalizedPayload: {
        ...payload,
        environments: [{ Environment: "prod", StepsDone: 2, Status: "building" }],
      },
    });
    expect(push?.environments[0]).toEqual({
      environment: "prod",
      stepsDone: 2,
      status: "building",
    });
  });

  it("accepts a bare payload", () => {
    expect(parseOrderPush(payload)?.state).toBe("creating");
  });

  it("ignores anything that is not an order", () => {
    expect(parseOrderPush("not json")).toBeNull();
    expect(parseOrderPush({ denormalizedPayload: "{}" })).toBeNull();
    expect(parseOrderPush(null)).toBeNull();
    expect(parseOrderPush(42)).toBeNull();
  });
});

describe("order feed", () => {
  it("keeps one entry per order and replaces it in place", () => {
    const { apply } = useOrderFeed.getState();
    apply(payload);
    apply({ ...payload, stepsDone: 4 });
    apply({ ...payload, orderId: "ord-2" });
    const { orders } = useOrderFeed.getState();
    expect(Object.keys(orders).sort()).toEqual(["ord-1", "ord-2"]);
    expect(orders["ord-1"].stepsDone).toBe(4);
  });

  it("a push keeps what only the read knew (total, market, charge time)", () => {
    const merged = mergeOrderPush(
      { ...payload, stepsDone: 5 },
      {
        ...payload,
        total: 420,
        market: "CHF",
        declineReason: "",
        chargedAtUtc: "2026-10-11T10:00:00Z",
        completedAtUtc: null,
      },
    );
    expect(merged.total).toBe(420);
    expect(merged.chargedAtUtc).toBe("2026-10-11T10:00:00Z");
    expect(merged.stepsDone).toBe(5);
  });
});
