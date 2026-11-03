import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatMinutes } from "../create-oidc/utils";
import OidcTemplate from "./oidc-template";
import { getPageOptions } from "./oidc-template-validation";

const GERMAN_OIDC = {
  "OIDC_TEMPLATE.TITLE": "OIDC-Vorlage",
  "OIDC_TEMPLATE.DESCRIPTION": "Konfigurieren Sie die Einstellungen Ihrer OIDC-Vorlage",
  "OIDC_TEMPLATE_VALIDATION.PAGE_LOGIN": "Anmeldung",
};
const GERMAN_CREATE_OIDC = {
  "CREATE_OIDC_UTILS.DURATION_HOURS_one": "{{count}} Stunde",
  "CREATE_OIDC_UTILS.DURATION_HOURS_other": "{{count}} Stunden",
};

const setLanguage = (language: "en" | "de") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.oidc German", () => {
  afterEach(() => setLanguage("en"));

  it("shows German text in a component, a constant list and a plural", () => {
    useI18nStore.getState().setRemote("de", "os.idp.oidc", GERMAN_OIDC);
    useI18nStore.getState().setRemote("de", "os.idp.create-oidc", GERMAN_CREATE_OIDC);
    setLanguage("de");

    render(<OidcTemplate />);
    expect(screen.getByText("OIDC-Vorlage")).toBeTruthy();
    expect(getPageOptions().find(({ key }) => key === "login")?.label).toBe("Anmeldung");
    expect(formatMinutes(60)).toBe("1 Stunde");
    expect(formatMinutes(120)).toBe("2 Stunden");
  });

  it("falls back to English when German is not registered", () => {
    setLanguage("en");
    expect(getPageOptions().find(({ key }) => key === "login")?.label).toBe("Login");
    expect(formatMinutes(120)).toBe("2 hours");
  });
});
