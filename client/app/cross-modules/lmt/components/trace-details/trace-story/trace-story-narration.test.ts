import { describe, expect, it } from "vitest";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { describeTransfer } from "./trace-story-narration";

const step = (overrides: Partial<FlowStep> = {}, attributes: FlowStep["span"]["attributes"] = {}) =>
  ({
    index: 1,
    spanId: "s",
    fromId: "svc:api",
    toId: "db:mongodb",
    traffic: "data",
    tag: "MongoDB find",
    operationName: "MongoDb::find",
    serviceName: "api",
    durationMs: 4,
    startTime: "",
    depth: 1,
    state: "ok",
    statusLabel: "OK",
    errorMessage: null,
    isErrorOrigin: false,
    isPropagatedError: false,
    causedByIndex: null,
    span: { attributes, kind: "Client" },
    ...overrides,
  }) as FlowStep;

describe("describeTransfer", () => {
  it("narrates the arriving request", () => {
    const story = describeTransfer(
      step({ fromId: "caller", traffic: "http", tag: "GET /users" }),
      "Caller",
      "api",
    );
    expect(story.title).toBe("The request arrives");
    expect(story.description).toBe("api receives GET /users.");
  });

  it("narrates reads and each kind of write with the collection", () => {
    const attrs = { "db.collection.name": "Orders" };
    expect(describeTransfer(step({}, attrs), "api", "MongoDB").description).toBe(
      "api looks up data in the Orders collection using MongoDB.",
    );
    const write = (operationName: string) =>
      describeTransfer(step({ operationName }, attrs), "api", "MongoDB").description;
    expect(write("MongoDb::insert")).toBe("api asks MongoDB to add data in the Orders collection.");
    expect(write("MongoDb::delete")).toBe(
      "api asks MongoDB to remove data from the Orders collection.",
    );
    expect(write("MongoDb::replace")).toBe(
      "api asks MongoDB to update data in the Orders collection.",
    );
    expect(write("MongoDb::bulkWrite")).toBe(
      "api asks MongoDB to run bulkWrite on the Orders collection.",
    );
    expect(
      describeTransfer(step({ operationName: "MongoDb::drop" }), "api", "MongoDB").description,
    ).toBe("api asks MongoDB to run drop.");
  });

  it("reports a cache hit or miss only when it was recorded", () => {
    const cache = (hit?: unknown, operationName = "Redis::Get") =>
      describeTransfer(
        step(
          { traffic: "cache", operationName, toId: "cache:redis" },
          hit === undefined ? {} : { "cache.hit": hit as string },
        ),
        "api",
        "Redis",
      );
    expect(cache("true").description).toContain("records a cache hit");
    expect(cache(0 as unknown as string).description).toContain("records a cache miss");
    expect(cache().description).toBe("api looks for cached data in Redis.");
    expect(cache(undefined, "Redis::Set").title).toBe("Updating the cache");
    expect(cache("true").facts).toContainEqual({ label: "Cache", value: "Hit" });
  });

  it("narrates messages, internal work and service calls", () => {
    expect(
      describeTransfer(
        step({
          traffic: "message",
          span: { kind: "Producer", attributes: {} } as FlowStep["span"],
        }),
        "api",
        "bus",
      ).title,
    ).toBe("Passing the work along");
    expect(
      describeTransfer(
        step({
          traffic: "message",
          span: {
            kind: "Consumer",
            attributes: { "messaging.message_type": "OrderPlaced" },
          } as FlowStep["span"],
        }),
        "bus",
        "worker",
      ),
    ).toMatchObject({
      title: "A worker picks it up",
      facts: [{ label: "Message", value: "OrderPlaced" }],
    });
    expect(
      describeTransfer(
        step({ traffic: "call", fromId: "svc:api", toId: "svc:api", operationName: "Validate" }),
        "api",
        "api",
      ).description,
    ).toBe("api runs Validate.");
    expect(
      describeTransfer(step({ traffic: "http", toId: "ext:pay", tag: "POST /pay" }), "api", "pay")
        .title,
    ).toBe("Calling the next service");
  });

  it("marks where an error started and where it only passed through", () => {
    const origin = describeTransfer(
      step({ state: "error", isErrorOrigin: true }),
      "api",
      "MongoDB",
    );
    expect(origin.title).toBe("This is where it failed");
    expect(origin.outcome).toBe("The operation reported a failure.");
    const passed = describeTransfer(step({ state: "error" }), "api", "MongoDB");
    expect(passed.description).toContain("This span also reports a failure.");
  });

  it("keeps cache-event wording for cache consumers, including failures", () => {
    const event = (overrides: Partial<FlowStep>) =>
      describeTransfer(
        step({
          traffic: "cache",
          operationName: "Redis::Invalidate",
          span: { kind: "Consumer", attributes: {} } as FlowStep["span"],
          ...overrides,
        }),
        "Redis",
        "api",
      );
    expect(event({}).title).toBe("Receiving a cache event");
    expect(event({ state: "error", isErrorOrigin: true })).toMatchObject({
      title: "This is where it failed",
      description: "api receives Invalidate from Redis. This span records an error.",
    });
    expect(event({ state: "warning" }).outcome).toBe("The operation reported a warning.");
    expect(event({ state: "unknown" }).outcome).toBe("A completion outcome was not recorded.");
  });

  it("lists at most three recorded facts", () => {
    const story = describeTransfer(
      step(
        {},
        {
          "db.collection.name": "Orders",
          "result.count": 0,
          "cache.hit": "false",
          "http.response.status_code": 200,
        },
      ),
      "api",
      "MongoDB",
    );
    expect(story.facts).toEqual([
      { label: "Collection", value: "Orders" },
      { label: "Recorded count", value: "0" },
      { label: "Cache", value: "Miss" },
    ]);
  });
});
