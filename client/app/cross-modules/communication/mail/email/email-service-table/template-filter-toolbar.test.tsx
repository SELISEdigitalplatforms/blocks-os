import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { search: "", language: "", mailConfigurationId: "", pageNumber: 0, pageSize: 10 },
  sort: vi.fn(),
  keys: [] as string[],
  optionCounts: {} as Record<string, number>,
}));

vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsInteger: parser,
    parseAsString: parser,
    useQueryStates: () => [h.queryParams, h.setQueryParams],
  };
});

vi.mock("@/components/filter-toolbar", () => ({
  useSortQueryParams: (arg: unknown) => {
    h.sort(arg);
    return [{ property: "Name", isDescending: false }, vi.fn()];
  },
  FilterToolbar: (props: Record<string, unknown>) => {
    const filters = props.filters as Array<{ key: string; props?: { options?: unknown[] } }>;
    h.keys = filters.map((f) => f.key);
    h.optionCounts = Object.fromEntries(
      filters.map((f) => [f.key, f.props?.options?.length ?? 0]),
    );
    return (
      <div>
        <button
          data-testid="change"
          onClick={() =>
            (props.onChange as (k: string, v: unknown, all: unknown) => void)("search", "q", {
              search: "q",
              language: "en",
              mailConfigurationId: "cfg-1",
            })
          }
        >
          change
        </button>
        <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
          reset
        </button>
      </div>
    );
  },
}));

import { TemplateFilterToolbar } from "./template-filter-toolbar";

const emailConfigsData = [
  { itemId: "cfg-1", name: "Primary" },
  { itemId: "cfg-2", name: "Secondary" },
];
const languageListData = [
  { itemId: "l1", languageName: "English", languageCode: "en" },
  { itemId: "l2", languageName: "German", languageCode: "de" },
];

describe("TemplateFilterToolbar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds radio options from the email configs and languages", () => {
    render(
      <TemplateFilterToolbar
        emailConfigsData={emailConfigsData}
        languageListData={languageListData}
      />,
    );
    expect(h.keys).toEqual(["search", "mailConfigurationId", "language"]);
    expect(h.optionCounts.mailConfigurationId).toBe(2);
    expect(h.optionCounts.language).toBe(2);
  });

  it("merges all filter values and resets the page on change", () => {
    render(
      <TemplateFilterToolbar
        emailConfigsData={emailConfigsData}
        languageListData={languageListData}
      />,
    );
    fireEvent.click(screen.getByTestId("change"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toMatchObject({
      search: "q",
      language: "en",
      mailConfigurationId: "cfg-1",
      pageNumber: 0,
    });
  });

  it("clears all params on reset", () => {
    render(
      <TemplateFilterToolbar
        emailConfigsData={emailConfigsData}
        languageListData={languageListData}
      />,
    );
    fireEvent.click(screen.getByTestId("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });
});
