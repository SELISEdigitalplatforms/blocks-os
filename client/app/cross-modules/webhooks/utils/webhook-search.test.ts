import { describe, expect, it } from "vitest";
import { makeWebhook } from "../test-utils/__mocks__";
import { filterWebhooks, webhookMatchesSearch } from "./webhook-search";

describe("webhookMatchesSearch", () => {
  const webhook = makeWebhook();

  it("matches everything for an empty or blank search", () => {
    expect(webhookMatchesSearch(webhook, "")).toBe(true);
    expect(webhookMatchesSearch(webhook, "  ")).toBe(true);
  });

  it.each([
    ["name", "crm SYNC"],
    ["url", "ACME.com/hooks"],
    ["action name", "USER.ACTIVATED"],
  ])("matches by %s, ignoring case", (_part, text) => {
    expect(webhookMatchesSearch(webhook, text)).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(webhookMatchesSearch(webhook, "invoice")).toBe(false);
  });
});

describe("filterWebhooks", () => {
  const list = [
    makeWebhook({ id: "a", name: "Alpha", url: "https://a.io/x", actions: ["one.two"] }),
    makeWebhook({ id: "b", name: "Beta", url: "https://b.io/y", actions: ["three.four"] }),
  ];

  it("keeps all for an empty search", () => {
    expect(filterWebhooks(list, "")).toEqual(list);
  });

  it("keeps only matches", () => {
    expect(filterWebhooks(list, "three").map((item) => item.id)).toEqual(["b"]);
    expect(filterWebhooks(list, "zzz")).toEqual([]);
  });
});
