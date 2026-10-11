import { describe, expect, it } from "vitest";
import { catalogueMock } from "@/test-utils/__mocks__/catalogue.mock";
import {
  WizardSelection,
  environmentPrice,
  formatLimit,
  freeTierEnvironment,
  fullEnvironments,
  limitsFor,
  maxSteps,
  previewOrder,
  projectSlug,
  reconcileDeployments,
  repoSlots,
  topUpSelections,
} from "./wizard-model";

const selection = (over: Partial<WizardSelection> = {}): WizardSelection => ({
  environments: ["dev", "test", "prod"],
  devTier: "free",
  topUps: {},
  ...over,
});

describe("wizard-model", () => {
  const catalogue = catalogueMock();

  it("finds the free-tier environment from the catalogue", () => {
    expect(freeTierEnvironment(catalogue)).toBe("dev");
  });

  it("uses free limits and the free price only for the free-tier env on the free tier", () => {
    expect(limitsFor(catalogue, "dev", "free")["api.calls"]).toBe(25000);
    expect(limitsFor(catalogue, "dev", "paid")["api.calls"]).toBe(100000);
    expect(limitsFor(catalogue, "test", "free")["api.calls"]).toBe(200000);
    expect(environmentPrice(catalogue, "dev", "free")).toBe(0);
    expect(environmentPrice(catalogue, "dev", "paid")).toBe(50);
    expect(environmentPrice(catalogue, "nope", "paid")).toBeNull();
  });

  it("caps top-ups at the catalogue multiple, none on free tier, no ceiling where uncapped", () => {
    // test includes 200,000 calls; ceiling 2× → 200,000 more → 2 steps of 100,000
    expect(maxSteps(catalogue, "test", "api.calls", "free")).toBe(2);
    expect(maxSteps(catalogue, "dev", "api.calls", "free")).toBe(0);
    expect(maxSteps(catalogue, "dev", "api.calls", "paid")).toBe(1);
    expect(maxSteps(catalogue, "prod", "api.calls", "free")).toBe(Number.POSITIVE_INFINITY);
    expect(maxSteps(catalogue, "test", "release.idleStopMinutes", "paid")).toBe(0);
  });

  it("drops top-ups of unselected environments and zero steps", () => {
    const s = selection({
      environments: ["dev", "prod"],
      topUps: { prod: { "api.calls": 2, "ai.agents": 0 }, test: { "api.calls": 1 } },
    });
    expect(topUpSelections(s)).toEqual([{ environment: "prod", meter: "api.calls", steps: 2 }]);
  });

  it("previews recurring and one-off separately, with VAT on both", () => {
    const p = previewOrder(
      catalogue,
      selection({ topUps: { prod: { "api.calls": 2, "ai.agents": 1 } } }),
    );
    // envs 0 + 80 + 300, agents 40 recurring; calls 40 one-off
    expect(p.recurring).toBe(420);
    expect(p.oneOff).toBe(40);
    expect(p.subtotal).toBe(460);
    expect(p.vat).toBe(37.26);
    expect(p.dueToday).toBe(497.26);
    expect(p.unpriced).toBe(false);
  });

  it("flags an unpriced environment instead of treating it as free", () => {
    const c = catalogueMock();
    c.environments.test.price = null;
    expect(previewOrder(c, selection()).unpriced).toBe(true);
  });

  it("counts repository slots including bought steps", () => {
    expect(repoSlots(catalogue, "dev", { devTier: "free", topUps: {} })).toBe(1);
    expect(
      repoSlots(catalogue, "test", { devTier: "free", topUps: { test: { "release.repos": 1 } } }),
    ).toBe(7);
  });

  it("reconciles picks: unticked envs and overflow after a tier change are dropped", () => {
    const s = selection({ environments: ["dev", "test"], devTier: "free" });
    const next = reconcileDeployments(
      catalogue,
      s,
      { a: ["dev", "test", "prod"], b: ["dev", "test"], c: ["test"] },
      ["a", "b", "c"],
    );
    // dev free → 1 slot (a keeps it); test 2 slots (a, b; c loses it); prod not selected
    expect(next).toEqual({ a: ["dev", "test"], b: ["test"], c: [] });
    expect(fullEnvironments(catalogue, s, next)).toEqual(["dev", "test"]);
  });

  it("formats identifiers and limits", () => {
    expect(projectSlug("Northwind Portal!")).toBe("northwind-portal");
    expect(projectSlug("   ")).toBe("untitled");
    expect(formatLimit(-1)).toBe("Unlimited");
    expect(formatLimit(0)).toBe("Not included");
    expect(formatLimit(5000, "MB")).toBe("5,000 MB");
    expect(formatLimit(15, "minute")).toBe("15 min");
    expect(formatLimit(3, "repo")).toBe("3");
  });
});
