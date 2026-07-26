import { describe, expect, it, vi } from "vitest";
import {
  lmtQueryAgentSchema,
  lmtQueryAgentFormDefaultValue,
  generateMessageId,
  getTimestampOrNow,
  isValidJSON,
  formatJSON,
  handleAgentEvent,
} from "./utils";

describe("lmtQueryAgentSchema", () => {
  it("accepts a non-empty query within the length limit", () => {
    expect(lmtQueryAgentSchema.safeParse({ query: "hello" }).success).toBe(true);
  });

  it("rejects an empty query", () => {
    const result = lmtQueryAgentSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a query over 500 characters", () => {
    expect(lmtQueryAgentSchema.safeParse({ query: "a".repeat(501) }).success).toBe(false);
  });

  it("exposes an empty default value", () => {
    expect(lmtQueryAgentFormDefaultValue).toEqual({ query: "" });
  });
});

describe("generateMessageId", () => {
  it("prefixes the id with the given type", () => {
    const id = generateMessageId("user");
    expect(id.startsWith("user-")).toBe(true);
  });

  it("produces unique ids", () => {
    expect(generateMessageId("a")).not.toBe(generateMessageId("a"));
  });
});

describe("getTimestampOrNow", () => {
  it("returns the string timestamp when given one", () => {
    expect(getTimestampOrNow("2024-01-01T00:00:00Z")).toBe("2024-01-01T00:00:00Z");
  });

  it("returns an ISO string when the input is not a string", () => {
    const result = getTimestampOrNow(12345);
    expect(typeof result).toBe("string");
    expect(() => new Date(result).toISOString()).not.toThrow();
  });
});

describe("isValidJSON", () => {
  it("returns true for an object literal string", () => {
    expect(isValidJSON('{"a":1}')).toBe(true);
  });

  it("returns false for a primitive JSON value", () => {
    expect(isValidJSON("42")).toBe(false);
  });

  it("returns false for invalid JSON", () => {
    expect(isValidJSON("{oops")).toBe(false);
  });
});

describe("formatJSON", () => {
  it("pretty-prints valid JSON", () => {
    expect(formatJSON('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it("returns the original string when it is not JSON", () => {
    expect(formatJSON("not json")).toBe("not json");
  });
});

describe("handleAgentEvent", () => {
  const makeCallbacks = () => ({
    showStatus: vi.fn(),
    clearStatus: vi.fn(),
    renderAnswer: vi.fn(),
    showError: vi.fn(),
  });

  it.each(["start", "agent_inference_started", "tool_call", "tool_result", "tool_error"])(
    "shows a status message for the %s event",
    (type) => {
      const cb = makeCallbacks();
      handleAgentEvent({ type }, cb);
      expect(cb.showStatus).toHaveBeenCalledTimes(1);
      expect(typeof cb.showStatus.mock.calls[0][0]).toBe("string");
    },
  );

  it("surfaces errors for the error event", () => {
    const cb = makeCallbacks();
    handleAgentEvent({ type: "error", error: "boom" }, cb);
    expect(cb.showError).toHaveBeenCalledWith("boom");
  });

  it("clears the status and renders the answer on final_answer", () => {
    const cb = makeCallbacks();
    const event = { type: "final_answer", answer: "42" };
    handleAgentEvent(event, cb);
    expect(cb.clearStatus).toHaveBeenCalled();
    expect(cb.renderAnswer).toHaveBeenCalledWith(event);
  });

  it("ignores unknown event types", () => {
    const cb = makeCallbacks();
    handleAgentEvent({ type: "something-else" }, cb);
    expect(cb.showStatus).not.toHaveBeenCalled();
    expect(cb.showError).not.toHaveBeenCalled();
    expect(cb.renderAnswer).not.toHaveBeenCalled();
  });
});
