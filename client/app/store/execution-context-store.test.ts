import { beforeEach, describe, expect, it } from "vitest";
import { useExecutionContextStore } from "./execution-context-store";

const context = { tenantId: "t-1", contextId: "ctx-1" };

describe("useExecutionContextStore", () => {
  beforeEach(() => {
    useExecutionContextStore.getState().reset();
  });

  it("starts with a null context", () => {
    expect(useExecutionContextStore.getState().context).toBeNull();
  });

  it("setContext stores the execution context", () => {
    useExecutionContextStore.getState().setContext(context);
    expect(useExecutionContextStore.getState().context).toEqual(context);
  });

  it("resetContext clears the context", () => {
    useExecutionContextStore.getState().setContext(context);
    useExecutionContextStore.getState().resetContext();
    expect(useExecutionContextStore.getState().context).toBeNull();
  });

  it("reset returns the store to its initial state", () => {
    useExecutionContextStore.getState().setContext(context);
    useExecutionContextStore.getState().reset();
    expect(useExecutionContextStore.getState().context).toBeNull();
  });
});
