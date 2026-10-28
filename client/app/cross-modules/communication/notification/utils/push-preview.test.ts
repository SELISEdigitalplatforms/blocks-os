import { describe, expect, it } from "vitest";
import type { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";
import {
  defaultCulture,
  missingLanguages,
  placeholderFields,
  previewText,
  splitKeyNames,
  withCurrent,
} from "./push-preview";

const key = (keyName: string, texts: Record<string, string>): IBlocksLanguageKey =>
  ({
    keyName,
    resources: Object.entries(texts).map(([culture, value]) => ({ culture, value })),
  }) as IBlocksLanguageKey;

const languages: ILanguageConfig[] = [
  { itemId: "1", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "2", languageName: "Deutsch", languageCode: "de-DE" },
  { itemId: "3", languageName: "Bangla", languageCode: "bn-BD" },
];
const keys = [
  key("ORDER_PAID_TITLE", { "en-US": "Order {{orderNo}} paid", "de-DE": "Bestellung bezahlt" }),
  key("ORDER_PAID_BODY", { "en-US": "{{amount}} received" }),
];

describe("push preview", () => {
  it("uses the chosen language, then the default language, then the key name", () => {
    expect(previewText(keys, "ORDER_PAID_TITLE", "de-DE", "en-US")).toBe("Bestellung bezahlt");
    expect(previewText(keys, "ORDER_PAID_BODY", "de-DE", "en-US")).toBe("{{amount}} received");
    expect(previewText(keys, "GONE_KEY", "de-DE", "en-US")).toBe("GONE_KEY");
    expect(previewText(keys, "", "de-DE", "en-US")).toBe("");
  });

  it("lists the languages that lack the title or the message", () => {
    expect(missingLanguages(keys, languages, "ORDER_PAID_TITLE", "ORDER_PAID_BODY")).toEqual([
      "Deutsch",
      "Bangla",
    ]);
    expect(missingLanguages(keys, languages, "", "ORDER_PAID_BODY")).toEqual([]);
  });

  it("offers *_TITLE and *_BODY keys, or every key when none is named that way", () => {
    expect(splitKeyNames(keys)).toEqual({
      titles: ["ORDER_PAID_TITLE"],
      bodies: ["ORDER_PAID_BODY"],
    });
    const plain = [key("A", {}), key("B", {})];
    expect(splitKeyNames(plain)).toEqual({ titles: ["A", "B"], bodies: ["A", "B"] });
  });

  it("keeps a saved key that Localization no longer lists", () => {
    expect(withCurrent(["A"], "OLD")).toEqual(["OLD", "A"]);
    expect(withCurrent(["A"], "A")).toEqual(["A"]);
  });

  it("finds the default language and the {{fields}} of the texts", () => {
    expect(defaultCulture(languages)).toBe("en-US");
    expect(defaultCulture([])).toBe("en-US");
    expect(placeholderFields(["Order {{orderNo}} {{ amount }}", "{{orderNo}}"])).toEqual([
      "orderNo",
      "amount",
    ]);
  });
});
