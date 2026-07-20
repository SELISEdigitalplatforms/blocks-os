import { beforeEach, describe, expect, it } from "vitest";
import { useImpersonateStore } from "./impersonate-store";

describe("useImpersonateStore", () => {
  beforeEach(() => {
    useImpersonateStore.getState().reset();
  });

  it("starts with no impersonation and uninitialized", () => {
    const s = useImpersonateStore.getState();
    expect(s.isImpersonated).toBe(false);
    expect(s.impersonatedTenantId).toBeNull();
    expect(s.originalTenantId).toBeNull();
    expect(s.isInitialized).toBe(false);
  });

  it("setImpersonation stores all three fields", () => {
    useImpersonateStore.getState().setImpersonation(true, "orig", "imp");
    const s = useImpersonateStore.getState();
    expect(s.isImpersonated).toBe(true);
    expect(s.originalTenantId).toBe("orig");
    expect(s.impersonatedTenantId).toBe("imp");
  });

  it("impersonate flags an active impersonation", () => {
    useImpersonateStore.getState().impersonate("imp-1", "orig-1");
    const s = useImpersonateStore.getState();
    expect(s.isImpersonated).toBe(true);
    expect(s.impersonatedTenantId).toBe("imp-1");
    expect(s.originalTenantId).toBe("orig-1");
  });

  it("terminate clears the impersonated tenant but keeps the original", () => {
    useImpersonateStore.getState().impersonate("imp-1", "orig-1");
    useImpersonateStore.getState().terminate("orig-1");
    const s = useImpersonateStore.getState();
    expect(s.isImpersonated).toBe(false);
    expect(s.impersonatedTenantId).toBeNull();
    expect(s.originalTenantId).toBe("orig-1");
  });

  it("setInitialized toggles the initialized flag", () => {
    useImpersonateStore.getState().setInitialized(true);
    expect(useImpersonateStore.getState().isInitialized).toBe(true);
  });

  it("reset restores every field to its default", () => {
    useImpersonateStore.getState().impersonate("imp-1", "orig-1");
    useImpersonateStore.getState().setInitialized(true);
    useImpersonateStore.getState().reset();
    const s = useImpersonateStore.getState();
    expect(s.isImpersonated).toBe(false);
    expect(s.impersonatedTenantId).toBeNull();
    expect(s.originalTenantId).toBeNull();
    expect(s.isInitialized).toBe(false);
  });
});
