import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { search: "", page: 0, pageSize: 10 },
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
  FilterToolbar: (props: Record<string, unknown>) => (
    <div>
      <button
        data-testid="change"
        onClick={() => (props.onChange as (k: string, v: unknown) => void)("search", "q")}
      >
        change
      </button>
      <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
        reset
      </button>
    </div>
  ),
}));

import { MagicUrlsFilterToolBar } from "./magic-urls-filter-toolbar";

describe("MagicUrlsFilterToolBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a filter value and resets the page", () => {
    render(<MagicUrlsFilterToolBar />);
    fireEvent.click(screen.getByTestId("change"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({ search: "" })).toMatchObject({ search: "q", page: 0 });
  });

  it("clears all params on reset", () => {
    render(<MagicUrlsFilterToolBar />);
    fireEvent.click(screen.getByTestId("reset"));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });
});
