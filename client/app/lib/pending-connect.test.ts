import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingConnectRequest,
  readPendingConnectRequest,
  savePendingConnectRequest,
} from "./pending-connect";

const storage = () => window.localStorage;

describe("pending-connect storage", () => {
  beforeEach(() => {
    storage().clear();
    vi.restoreAllMocks();
  });

  it("round-trips a pending request", () => {
    savePendingConnectRequest({ requestId: "req-1", expiresAt: new Date(Date.now() + 60_000).toISOString() });

    expect(readPendingConnectRequest()).toEqual({
      requestId: "req-1",
      expiresAt: expect.any(String),
    });
    expect(readPendingConnectRequest()?.requestId).toBe("req-1");
  });

  it("returns null and deletes an expired request", () => {
    savePendingConnectRequest({ requestId: "req-1", expiresAt: new Date(Date.now() - 1_000).toISOString() });

    expect(readPendingConnectRequest()).toBeNull();
    expect(storage().getItem("blocks:pending-integration-request")).toBeNull();
  });

  it("returns null for unreadable entries", () => {
    storage().setItem("blocks:pending-integration-request", "{not json");

    expect(readPendingConnectRequest()).toBeNull();
  });

  it("clear removes the entry", () => {
    savePendingConnectRequest({ requestId: "req-1", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    clearPendingConnectRequest();

    expect(readPendingConnectRequest()).toBeNull();
  });

  it("tolerates storage being unavailable", () => {
    const getter = vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => savePendingConnectRequest({ requestId: "r", expiresAt: new Date().toISOString() })).not.toThrow();
    expect(readPendingConnectRequest()).toBeNull();
    expect(() => clearPendingConnectRequest()).not.toThrow();

    getter.mockRestore();
  });
});
