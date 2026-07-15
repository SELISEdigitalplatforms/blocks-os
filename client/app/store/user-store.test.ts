import { beforeEach, describe, expect, it } from "vitest";
import { useUserStore } from "./user-store";
import type { User } from "@blocks-idp/iam/models/user";

const user = { itemId: "u-1", email: "a@b.com" } as unknown as User;

describe("useUserStore", () => {
  beforeEach(() => {
    useUserStore.getState().reset();
  });

  it("starts with a null user", () => {
    expect(useUserStore.getState().user).toBeNull();
  });

  it("setUser stores the user", () => {
    useUserStore.getState().setUser(user);
    expect(useUserStore.getState().user).toEqual(user);
  });

  it("setUser(null) clears the user", () => {
    useUserStore.getState().setUser(user);
    useUserStore.getState().setUser(null);
    expect(useUserStore.getState().user).toBeNull();
  });

  it("reset clears the stored user", () => {
    useUserStore.getState().setUser(user);
    useUserStore.getState().reset();
    expect(useUserStore.getState().user).toBeNull();
  });
});
