import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  setQueryParams: vi.fn(),
  queryParams: {
    notificationSearch: "",
    notificationImportance: "",
    notificationService: "",
    notificationSendTo: "",
    notificationReceivers: "",
    notificationPage: 0,
    notificationPageSize: 10,
  },
  lastProps: undefined as Record<string, unknown> | undefined,
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
  FilterToolbar: (props: Record<string, unknown>) => {
    h.lastProps = props;
    return (
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
        <button
          data-testid="change-importance"
          onClick={() => (props.onChange as (k: string, v: unknown) => void)("importance", "3")}
        >
          change importance
        </button>
        <button
          data-testid="change-service"
          onClick={() =>
            (props.onChange as (k: string, v: unknown) => void)("service", IAM_SERVICE)
          }
        >
          change service
        </button>
        <button
          data-testid="change-send-to"
          onClick={() => (props.onChange as (k: string, v: unknown) => void)("sendTo", "1")}
        >
          change send to
        </button>
        <button
          data-testid="change-receivers"
          onClick={() => (props.onChange as (k: string, v: unknown) => void)("receivers", "2")}
        >
          change receivers
        </button>
        <button data-testid="reset" onClick={() => (props.onReset as () => void)()}>
          reset
        </button>
      </div>
    );
  },
}));

import { NotificationConfigsFilterToolBar } from "./notification-configs-filter-toolbar";

const IAM_SERVICE = "blocks-iam";

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

  it("maps importance and service changes onto their query params and resets the page", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("change-importance"));
    fireEvent.click(screen.getByTestId("change-service"));
    const first = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    const second = h.setQueryParams.mock.calls[1][0] as (p: object) => object;
    expect(first({})).toMatchObject({ notificationImportance: "3", notificationPage: 0 });
    expect(second({})).toMatchObject({ notificationService: IAM_SERVICE, notificationPage: 0 });
  });

  it("maps Send to and Receivers changes onto their query params and resets the page", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("change-send-to"));
    fireEvent.click(screen.getByTestId("change-receivers"));
    const first = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    const second = h.setQueryParams.mock.calls[1][0] as (p: object) => object;
    expect(first({})).toMatchObject({ notificationSendTo: "1", notificationPage: 0 });
    expect(second({})).toMatchObject({ notificationReceivers: "2", notificationPage: 0 });
  });

  it("clears every filter on reset", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("reset"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toMatchObject({ notificationSendTo: "", notificationReceivers: "" });
  });

  it("clears importance and service on reset", () => {
    render(<NotificationConfigsFilterToolBar />);
    fireEvent.click(screen.getByTestId("reset"));
    const updater = h.setQueryParams.mock.calls[0][0] as (p: object) => object;
    expect(updater({})).toMatchObject({ notificationImportance: "", notificationService: "" });
  });

  it("offers the service filter only when services are known", () => {
    const keys = () => (h.lastProps?.filters as { key: string }[]).map((f) => f.key);
    render(<NotificationConfigsFilterToolBar />);
    expect(keys()).toEqual(["search", "importance", "sendTo", "receivers"]);
    render(<NotificationConfigsFilterToolBar serviceOptions={[IAM_SERVICE]} />);
    expect(keys()).toEqual(["search", "importance", "sendTo", "receivers", "service"]);
  });
});
