import type { ICatalogueResponse } from "@blocks-identifier/models/catalogue.model";

/**
 * A small catalogue in the published shape: a free-tier dev, a capped test, an uncapped prod,
 * one counter (one-off) meter, one resource (recurring) meter, the repository meter and a policy.
 */
export const catalogueMock = (): ICatalogueResponse => ({
  catalogueVersion: "test-1",
  priceBookVersion: "pb-1",
  market: "CHF",
  markets: ["CHF", "USD"],
  usagePeriodDays: 30,
  topUp: {
    requiresPaidEnvironment: true,
    maxMultipleOfIncluded: 2,
    roundDownToWholeStep: true,
    counterUnitsCarry: true,
    drainOrder: ["allowance", "purchased"],
    resourceUnitsRecurring: true,
    resourceDecreaseAt: "usagePeriodEnd",
  },
  services: {
    api: {
      label: "API",
      meters: {
        calls: {
          label: "API calls",
          unit: "call",
          scope: "environment",
          kind: "counter",
          reset: "period",
        },
      },
    },
    ai: {
      label: "AI",
      meters: {
        agents: {
          label: "Agents",
          unit: "agent",
          scope: "environment",
          kind: "resource",
          reset: "never",
        },
      },
    },
    release: {
      label: "Release",
      meters: {
        repos: {
          label: "Repositories",
          unit: "repo",
          scope: "environment",
          kind: "resource",
          reset: "never",
        },
        idleStopMinutes: {
          label: "Idle stop",
          unit: "minute",
          scope: "environment",
          kind: "policy",
          reset: "never",
          purchasable: false,
        },
      },
    },
  },
  environments: {
    dev: {
      label: "Development",
      rank: 1,
      freeTierAvailable: true,
      topUpUncapped: false,
      price: 50,
      freePrice: 0,
      limits: {
        "api.calls": 100000,
        "ai.agents": 7,
        "release.repos": 3,
        "release.idleStopMinutes": 30,
      },
      freeLimits: {
        "api.calls": 25000,
        "ai.agents": 2,
        "release.repos": 1,
        "release.idleStopMinutes": 15,
      },
    },
    test: {
      label: "Test",
      rank: 2,
      freeTierAvailable: false,
      topUpUncapped: false,
      price: 80,
      freePrice: null,
      limits: {
        "api.calls": 200000,
        "ai.agents": 15,
        "release.repos": 2,
        "release.idleStopMinutes": 45,
      },
      freeLimits: null,
    },
    prod: {
      label: "Production",
      rank: 7,
      freeTierAvailable: false,
      topUpUncapped: true,
      price: 300,
      freePrice: null,
      limits: {
        "api.calls": 1200000,
        "ai.agents": 60,
        "release.repos": 20,
        "release.idleStopMinutes": -1,
      },
      freeLimits: null,
    },
  },
  topUpSteps: {
    "api.calls": { step: 100000, billing: "oneOffCarries", price: 20 },
    "ai.agents": { step: 5, billing: "recurringWhileHeld", price: 40 },
    "release.repos": { step: 5, billing: "recurringWhileHeld", price: 20 },
  },
  problems: [],
});
