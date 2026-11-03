import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";

import { ARCHIVE_ERROR_MESSAGES } from "../constants/archive-error-messages";
import { PERMISSION_SEVERITY_OPTIONS } from "../models/permission";
import { getAssignableRolesHelper } from "./grant-scope";
import { USER_ACCOUNT_STATE_META } from "./user-account-state";

const REMOTE = {
  "GRANT_SCOPE.ASSIGNABLE_ROLES_HELPER": "[xx] GRANT_SCOPE.ASSIGNABLE_ROLES_HELPER",
  "PERMISSION.SEVERITY_CRITICAL": "[xx] PERMISSION.SEVERITY_CRITICAL",
  "USER_ACCOUNT_STATE.ACTIVE": "[xx] USER_ACCOUNT_STATE.ACTIVE",
  "ARCHIVE_ERROR_MESSAGES.ROLE_ALREADY_ARCHIVED":
    "[xx] ARCHIVE_ERROR_MESSAGES.ROLE_ALREADY_ARCHIVED",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.iam non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("translates helpers and constant tables when the language is read", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.iam", REMOTE);
    setLanguage("xx");

    expect(getAssignableRolesHelper()).toBe(REMOTE["GRANT_SCOPE.ASSIGNABLE_ROLES_HELPER"]);
    expect(PERMISSION_SEVERITY_OPTIONS[0].label).toBe("[xx] PERMISSION.SEVERITY_CRITICAL");
    expect(USER_ACCOUNT_STATE_META.Active.label).toBe("[xx] USER_ACCOUNT_STATE.ACTIVE");
    expect(ARCHIVE_ERROR_MESSAGES.Role_Already_Archived).toBe(
      "[xx] ARCHIVE_ERROR_MESSAGES.ROLE_ALREADY_ARCHIVED",
    );
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    expect(PERMISSION_SEVERITY_OPTIONS[0].label).toBe("Critical");
    expect(USER_ACCOUNT_STATE_META.Active.label).toBe("Active");
  });
});
