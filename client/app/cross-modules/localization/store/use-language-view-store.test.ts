import { beforeEach, describe, expect, it } from "vitest";
import { useLanguageViewStore } from "./use-language-view-store";

describe("useLanguageViewStore", () => {
  beforeEach(() => {
    useLanguageViewStore.getState().resetSelectedLanguages();
  });

  it("setSelectedLanguages replaces the list", () => {
    useLanguageViewStore.getState().setSelectedLanguages(["en", "de"]);
    expect(useLanguageViewStore.getState().selectedLanguages).toEqual(["en", "de"]);
  });

  it("toggleLanguage adds then removes a language", () => {
    useLanguageViewStore.getState().toggleLanguage("en");
    expect(useLanguageViewStore.getState().selectedLanguages).toContain("en");
    useLanguageViewStore.getState().toggleLanguage("en");
    expect(useLanguageViewStore.getState().selectedLanguages).not.toContain("en");
  });

  it("setSelectedOptionalColumns and toggleOptionalColumn manage columns", () => {
    useLanguageViewStore.getState().setSelectedOptionalColumns(["a"]);
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toEqual(["a"]);
    useLanguageViewStore.getState().toggleOptionalColumn("b");
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toEqual(["a", "b"]);
    useLanguageViewStore.getState().toggleOptionalColumn("a");
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toEqual(["b"]);
  });

  it("resetSelectedLanguages clears both languages and columns", () => {
    useLanguageViewStore.getState().setSelectedLanguages(["en"]);
    useLanguageViewStore.getState().setSelectedOptionalColumns(["a"]);
    useLanguageViewStore.getState().resetSelectedLanguages();
    expect(useLanguageViewStore.getState().selectedLanguages).toEqual([]);
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toEqual([]);
  });
});
