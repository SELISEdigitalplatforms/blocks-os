import { useAppSettingsStore, useI18nStore } from "@seliseblocks/genesis-os";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

describe("Pagination in a non-default language", () => {
  afterEach(() => {
    useAppSettingsStore.getState().setSettings({ language: "en" });
  });

  it("shows the non-default language page label when a remote dictionary is registered", () => {
    useI18nStore.getState().setRemote("xx", "os.shared", {
      "PAGINATION.PAGE_OF": "[xx] PAGINATION.PAGE_OF {{page}} {{total}}",
    });
    useAppSettingsStore.getState().setSettings({ language: "xx" });

    render(<Pagination page={0} onChange={() => {}} totalCount={30} pageSize={10} />);

    expect(screen.getByText("[xx] PAGINATION.PAGE_OF 1 3")).toBeTruthy();
  });

  it("falls back to English when the language is English", () => {
    render(<Pagination page={0} onChange={() => {}} totalCount={30} pageSize={10} />);

    expect(screen.getByText("Page 1 of 3")).toBeTruthy();
  });
});
