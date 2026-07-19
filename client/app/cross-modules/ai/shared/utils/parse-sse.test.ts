import { describe, expect, it } from "vitest";
import { parseSSEEvent, parseSSEBuffer } from "./parse-sse";

describe("parseSSEEvent", () => {
  it("parses a well-formed event/data pair", () => {
    const result = parseSSEEvent('event: message\ndata: {"text":"hi"}');
    expect(result).toEqual({ eventType: "message", eventData: { text: "hi" } });
  });

  it("returns null when the event line is missing", () => {
    expect(parseSSEEvent('data: {"text":"hi"}')).toBeNull();
  });

  it("returns null when the data line is missing", () => {
    expect(parseSSEEvent("event: message")).toBeNull();
  });

  it("returns null when data is not valid JSON", () => {
    expect(parseSSEEvent("event: message\ndata: not-json")).toBeNull();
  });
});

describe("parseSSEBuffer", () => {
  it("splits complete events and keeps the trailing partial as remaining", () => {
    const buffer =
      'event: a\ndata: {"n":1}\n\nevent: b\ndata: {"n":2}\n\nevent: c\ndata: {"n":3}';
    const { events, remaining } = parseSSEBuffer(buffer);
    expect(events).toEqual([
      { eventType: "a", eventData: { n: 1 } },
      { eventType: "b", eventData: { n: 2 } },
    ]);
    expect(remaining).toBe('event: c\ndata: {"n":3}');
  });

  it("supports CRLF separators", () => {
    const buffer = 'event: a\r\ndata: {"n":1}\r\n\r\n';
    const { events, remaining } = parseSSEBuffer(buffer);
    expect(events).toHaveLength(1);
    expect(remaining).toBe("");
  });

  it("drops unparseable chunks", () => {
    const buffer = "garbage\n\nevent: a\ndata: {}\n\n";
    const { events } = parseSSEBuffer(buffer);
    expect(events).toEqual([{ eventType: "a", eventData: {} }]);
  });
});
