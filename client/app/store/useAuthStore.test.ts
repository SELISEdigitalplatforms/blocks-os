import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./useAuthStore";
import type { User } from "@blocks-idp/iam/models/user";

const user = { itemId: "u-1", email: "a@b.com" } as unknown as User;

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.getState().reset();
  });

  it("starts unauthenticated with null values", () => {
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
  });

  it("setUser marks the store authenticated", () => {
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("setUser(null) marks the store unauthenticated", () => {
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("setAuthenticated / setUnAuthenticated toggle the flag", () => {
    useAuthStore.getState().setAuthenticated();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    useAuthStore.getState().setUnAuthenticated();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("setTokens / clearTokens manage the token pair", () => {
    useAuthStore.getState().setTokens("access", "refresh");
    expect(useAuthStore.getState().accessToken).toBe("access");
    expect(useAuthStore.getState().refreshToken).toBe("refresh");
    useAuthStore.getState().clearTokens();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("reset restores all defaults", () => {
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setTokens("a", "b");
    useAuthStore.getState().reset();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
  });
});
