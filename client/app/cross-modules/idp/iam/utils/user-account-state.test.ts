import { describe, expect, it } from "vitest";
import {
  LOCKED_OUT_FILTER,
  USER_ACCOUNT_STATE_FILTER_OPTIONS,
  resolveUserAccountState,
  toAccountStatesFilter,
} from "./user-account-state";

describe("toAccountStatesFilter", () => {
  it("keeps recognised values, deduplicated and in option order", () => {
    expect(toAccountStatesFilter(["LockedOut", "Suspended", "Suspended"])).toEqual([
      "Suspended",
      "LockedOut",
    ]);
  });

  it("drops values IAM does not know, and treats nothing as nothing", () => {
    expect(toAccountStatesFilter(["Verified", "active"])).toEqual([]);
    expect(toAccountStatesFilter(undefined)).toEqual([]);
    expect(toAccountStatesFilter(null)).toEqual([]);
  });

  it("offers the four lifecycle states and then Locked out", () => {
    expect(USER_ACCOUNT_STATE_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      "Active",
      "Inactive",
      "Suspended",
      "Deactivated",
      "Locked out",
    ]);
    expect(USER_ACCOUNT_STATE_FILTER_OPTIONS.at(-1)?.value).toBe(LOCKED_OUT_FILTER);
  });
});

describe("resolveUserAccountState", () => {
  it("uses IAM's accountState when it is one it knows", () => {
    expect(resolveUserAccountState({ accountState: "Suspended", active: true })).toBe("Suspended");
  });

  it("ignores an unknown accountState, including inherited object keys", () => {
    expect(resolveUserAccountState({ accountState: "Frozen", active: true })).toBe("Active");
    expect(resolveUserAccountState({ accountState: "constructor", active: true })).toBe("Active");
  });

  it("falls back to IAM's rule when accountState is missing", () => {
    expect(resolveUserAccountState({ active: true })).toBe("Active");
    expect(resolveUserAccountState({ active: false, isVerified: true })).toBe("Deactivated");
    expect(resolveUserAccountState({ active: false, isVerified: false })).toBe("PendingVerification");
    expect(resolveUserAccountState({ active: false })).toBe("PendingVerification");
  });
});
