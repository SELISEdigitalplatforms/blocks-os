import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { afterEach, describe, expect, it } from "vitest";

import { ARCHIVE_ERROR_MESSAGES } from "../constants/archive-error-messages";
import { PERMISSION_SEVERITY_OPTIONS } from "../models/permission";
import { getAssignableRolesHelper } from "./grant-scope";
import { USER_ACCOUNT_STATE_META } from "./user-account-state";

const GERMAN = {
  "GRANT_SCOPE.ASSIGNABLE_ROLES_HELPER":
    "Sie können nur Rollen vergeben, die unter Ihrer Rolle liegen.",
  "PERMISSION.SEVERITY_CRITICAL": "Kritisch",
  "USER_ACCOUNT_STATE.ACTIVE": "Aktiv",
  "ARCHIVE_ERROR_MESSAGES.ROLE_ALREADY_ARCHIVED": "Diese Rolle ist bereits archiviert.",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.iam German", () => {
  afterEach(() => setLanguage("en"));

  it("translates helpers and constant tables when the language is read", () => {
    useI18nStore.getState().setRemote("de", "os.idp.iam", GERMAN);
    setLanguage("de");

    expect(getAssignableRolesHelper()).toBe(GERMAN["GRANT_SCOPE.ASSIGNABLE_ROLES_HELPER"]);
    expect(PERMISSION_SEVERITY_OPTIONS[0].label).toBe("Kritisch");
    expect(USER_ACCOUNT_STATE_META.Active.label).toBe("Aktiv");
    expect(ARCHIVE_ERROR_MESSAGES.Role_Already_Archived).toBe(
      "Diese Rolle ist bereits archiviert.",
    );
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    expect(PERMISSION_SEVERITY_OPTIONS[0].label).toBe("Critical");
    expect(USER_ACCOUNT_STATE_META.Active.label).toBe("Active");
  });
});
