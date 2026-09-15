import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InfiniteScroll } from "./infinite-scroller";

// jsdom does not implement Element.scrollTo, which the mount effect calls.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

type Item = { id: number };

const renderItem = (item: Item) => <div key={item.id} data-testid="row">{item.id}</div>;

const baseProps = () => ({
  renderItem,
  topFn: vi.fn(async () => [] as Item[]),
  pollingFn: vi.fn(async () => [] as Item[]),
  pollingInterval: 1000,
  loadingIndicator: <div data-testid="loading">loading</div>,
  hasTopMore: true,
  bottomIndicator: (cb: () => void) => (
    <button data-testid="bottom" onClick={cb}>
      new
    </button>
  ),
});

describe("InfiniteScroll", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the initial rows", () => {
    render(<InfiniteScroll<Item> {...baseProps()} initialData={[{ id: 1 }, { id: 2 }]} />);
    expect(screen.getAllByTestId("row")).toHaveLength(2);
  });

  it("shows the empty state when there is no data", () => {
    render(<InfiniteScroll<Item> {...baseProps()} initialData={[]} />);
    expect(screen.getByText("No logs found")).toBeTruthy();
  });

  it("fetches older data when scrolled to the top", async () => {
    const props = baseProps();
    props.topFn = vi.fn(async () => [{ id: 0 }]);
    const { container } = render(
      <InfiniteScroll<Item> {...props} initialData={[{ id: 1 }]} />,
    );
    const scrollContainer = container.querySelector(
      "[data-testid='infinite-scroll-container']",
    ) as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollTop", { value: 0, configurable: true, writable: true });
    fireEvent.scroll(scrollContainer);
    await waitFor(() => expect(props.topFn).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByTestId("row").length).toBe(2));
  });

  it("stops requesting older data once the top function returns nothing", async () => {
    const props = baseProps();
    props.topFn = vi.fn(async () => []);
    const { container } = render(
      <InfiniteScroll<Item> {...props} initialData={[{ id: 1 }]} />,
    );
    const scrollContainer = container.querySelector(
      "[data-testid='infinite-scroll-container']",
    ) as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollTop", { value: 0, configurable: true, writable: true });
    fireEvent.scroll(scrollContainer);
    await waitFor(() => expect(props.topFn).toHaveBeenCalledTimes(1));
  });

  it("polls for newer data and surfaces the bottom indicator", async () => {
    const props = { ...baseProps(), pollingInterval: 30 };
    props.pollingFn = vi.fn(async () => [{ id: 99 }]);
    render(<InfiniteScroll<Item> {...props} initialData={[{ id: 1 }]} />);
    await waitFor(() => expect(props.pollingFn).toHaveBeenCalled());
    // once newer data arrives, the bottom indicator is shown
    expect(await screen.findByTestId("bottom")).toBeTruthy();
  });
});
