import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

describe("Pagination in German", () => {
  afterEach(() => {
    useAppSettingsStore.getState().setSettings({ language: "en" });
  });

  it("shows the German page label when a German dictionary is registered", () => {
    useI18nStore.getState().setRemote("de", "os.shared", {
      "PAGINATION.PAGE_OF": "Seite {{page}} von {{total}}",
    });
    useAppSettingsStore.getState().setSettings({ language: "de" });

    render(<Pagination page={0} onChange={() => {}} totalCount={30} pageSize={10} />);

    expect(screen.queryByText("Seite 1 von 3")).toBeTruthy();
  });

  it("falls back to English when the language is English", () => {
    render(<Pagination page={0} onChange={() => {}} totalCount={30} pageSize={10} />);

    expect(screen.queryByText("Page 1 of 3")).toBeTruthy();
  });
});
