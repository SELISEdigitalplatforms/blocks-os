import { describe, expect, it } from "vitest";
import {
  buildServiceKey,
  parseServiceKey,
  serviceKeyToTreeValues,
  treeValuesToServiceKey,
} from "./service-selection.util";

describe("parseServiceKey", () => {
  it("returns nothing for an empty key", () => {
    expect(parseServiceKey("")).toEqual([]);
  });

  it("reads a whole service", () => {
    expect(parseServiceKey("iam")).toEqual([{ serviceId: "iam", components: [] }]);
  });

  it("reads a service narrowed to components", () => {
    expect(parseServiceKey("iam::iam-api,iam-worker")).toEqual([
      { serviceId: "iam", components: ["iam-api", "iam-worker"] },
    ]);
  });

  it("reads several services in one key", () => {
    expect(parseServiceKey("iam::iam-api;os;data::data-worker")).toEqual([
      { serviceId: "iam", components: ["iam-api"] },
      { serviceId: "os", components: [] },
      { serviceId: "data", components: ["data-worker"] },
    ]);
  });

  it("merges a service that appears twice in a hand-edited key", () => {
    expect(parseServiceKey("iam::iam-api;iam::iam-worker,iam-api")).toEqual([
      { serviceId: "iam", components: ["iam-api", "iam-worker"] },
    ]);
  });

  it("skips empty groups and empty components", () => {
    expect(parseServiceKey(";iam::,;os")).toEqual([
      { serviceId: "iam", components: [] },
      { serviceId: "os", components: [] },
    ]);
  });
});

describe("buildServiceKey", () => {
  it("joins services and their components", () => {
    expect(
      buildServiceKey([
        { serviceId: "iam", components: ["iam-api", "iam-worker"] },
        { serviceId: "os", components: [] },
      ]),
    ).toBe("iam::iam-api,iam-worker;os");
  });

  it("drops entries without a service id", () => {
    expect(buildServiceKey([{ serviceId: "", components: ["x"] }])).toBe("");
  });
});

describe("serviceKeyToTreeValues", () => {
  it("maps a whole service to its parent option value", () => {
    expect(serviceKeyToTreeValues("iam")).toEqual(["iam"]);
  });

  it("maps narrowed components to child option values", () => {
    expect(serviceKeyToTreeValues("iam::iam-api;os")).toEqual(["iam::iam-api", "os"]);
  });
});

describe("treeValuesToServiceKey", () => {
  it("groups child values under their service", () => {
    expect(treeValuesToServiceKey(["iam::iam-api", "iam::iam-worker", "os"])).toBe(
      "iam::iam-api,iam-worker;os",
    );
  });

  it("keeps the first appearance order of each service", () => {
    expect(treeValuesToServiceKey(["os", "iam::iam-api"])).toBe("os;iam::iam-api");
  });

  it("de-duplicates repeated values", () => {
    expect(treeValuesToServiceKey(["iam::iam-api", "iam::iam-api"])).toBe("iam::iam-api");
  });

  it("returns an empty key for an empty selection", () => {
    expect(treeValuesToServiceKey([])).toBe("");
  });
});

describe("round trip", () => {
  it("survives key → tree values → key", () => {
    const key = "iam::iam-api,iam-worker;os;data::data-worker";
    expect(treeValuesToServiceKey(serviceKeyToTreeValues(key))).toBe(key);
  });
});
