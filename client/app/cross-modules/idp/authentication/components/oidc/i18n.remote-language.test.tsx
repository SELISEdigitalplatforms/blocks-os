import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatMinutes } from "../create-oidc/utils";
import OidcTemplate from "./oidc-template";
import { getPageOptions } from "./oidc-template-validation";

const REMOTE_OIDC = {
  "OIDC_TEMPLATE.TITLE": "[xx] OIDC_TEMPLATE.TITLE",
  "OIDC_TEMPLATE.DESCRIPTION": "[xx] OIDC_TEMPLATE.DESCRIPTION",
  "OIDC_TEMPLATE_VALIDATION.PAGE_LOGIN": "[xx] OIDC_TEMPLATE_VALIDATION.PAGE_LOGIN",
};
const REMOTE_CREATE_OIDC = {
  "CREATE_OIDC_UTILS.DURATION_HOURS_one": "{{count}} xx-hour",
  "CREATE_OIDC_UTILS.DURATION_HOURS_other": "{{count}} xx-hours",
};

const setLanguage = (language: "en" | "xx") =>
  useAppSettingsStore.getState().setSettings({ language });

describe("os.idp.oidc non-default language", () => {
  afterEach(() => setLanguage("en"));

  it("shows remote text in a component, a constant list and a plural", () => {
    useI18nStore.getState().setRemote("xx", "os.idp.oidc", REMOTE_OIDC);
    useI18nStore.getState().setRemote("xx", "os.idp.create-oidc", REMOTE_CREATE_OIDC);
    setLanguage("xx");

    render(<OidcTemplate />);
    expect(screen.getByText("[xx] OIDC_TEMPLATE.TITLE")).toBeTruthy();
    expect(getPageOptions().find(({ key }) => key === "login")?.label).toBe(
      "[xx] OIDC_TEMPLATE_VALIDATION.PAGE_LOGIN",
    );
    expect(formatMinutes(60)).toBe("1 xx-hour");
    expect(formatMinutes(120)).toBe("2 xx-hours");
  });

  it("falls back to English when the language has no remote dictionary", () => {
    setLanguage("en");
    expect(getPageOptions().find(({ key }) => key === "login")?.label).toBe("Login");
    expect(formatMinutes(120)).toBe("2 hours");
  });
});
