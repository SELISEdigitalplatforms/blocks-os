import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: { notificationSearch: "", notificationPage: 0, notificationPageSize: 10 },
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
        data-testid="change-search"
        onClick={() => (props.onChange as (k: string, v: unknown) => void)("search", "hi")}
      >
        change search
      </button>
      <button
        data-testid="change-other"
        onClick={() => (props.onChange as (k: string, v: unknown) => void)("other", "y")}
      >
        change other
      </button>
      <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
        reset
      </button>
    </div>
  ),
}));

import { NotificationConfigsFilterToolBar } from "./notification-configs-filter-toolbar";

describe("NotificationConfigsFilterToolBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a search change onto notificationSearch and resets the page", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("change-search"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toMatchObject({ notificationSearch: "hi", notificationPage: 0 });
  });

  it("ignores non-search changes", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("change-other"));
    expect(h.setQueryParams).not.toHaveBeenCalled();
  });

  it("resets the search and page on reset", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("reset"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toMatchObject({ notificationSearch: "", notificationPage: 0 });
  });
});
