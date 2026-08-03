import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationsSidebarList } from "./organizations-sidebar-list";

// The component is purely presentational: every piece of data and every
// callback arrives via props, so no module mocks are required.

type OrgOverrides = Partial<{
  itemId: string;
  name: string;
  isDisabled: boolean;
  lastUpdatedDate: string;
  logoUrl: string | null;
}>;

// Cast through unknown: the component only reads a handful of IOrganization
// fields, so an exhaustive object is unnecessary noise in the test.
const makeOrg = (over: OrgOverrides) =>
  ({
    itemId: "org-1",
    name: "Acme Inc",
    isDisabled: false,
    lastUpdatedDate: "2026-07-01T00:00:00.000Z",
    logoUrl: null,
    ...over,
  }) as unknown as Parameters<typeof OrganizationsSidebarList>[0]["organizations"][number];

const baseProps = () => ({
  organizations: [
    makeOrg({ itemId: "org-1", name: "Acme Inc" }),
    makeOrg({ itemId: "org-2", name: "Globex" }),
  ],
  totalCount: 2,
  selectedOrgId: null as string | null,
  onSelect: vi.fn(),
  search: "",
  onSearchChange: vi.fn(),
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  onLoadMore: vi.fn(),
});

// The component observes a sentinel element to trigger infinite scroll. The
// jsdom polyfill in the global setup is inert, so capture the callback here and
// drive the intersection by hand.
let intersect: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
let disconnected = 0;
const realIntersectionObserver = globalThis.IntersectionObserver;

class CapturingIntersectionObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    intersect = callback;
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    disconnected += 1;
  }
  takeRecords(): [] {
    return [];
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  intersect = null;
  disconnected = 0;
  (globalThis as Record<string, unknown>).IntersectionObserver =
    CapturingIntersectionObserver;
});

afterEach(() => {
  (globalThis as Record<string, unknown>).IntersectionObserver = realIntersectionObserver;
  vi.useRealTimers();
});

describe("OrganizationsSidebarList", () => {
  it("renders every organization and the footer count", () => {
    render(<OrganizationsSidebarList {...baseProps()} />);
    expect(screen.getByText("Acme Inc")).toBeTruthy();
    expect(screen.getByText("Globex")).toBeTruthy();
    expect(screen.getByText(/Showing 1 to 2 of 2 organizations/)).toBeTruthy();
  });

  it("shows the empty state when there are no organizations", () => {
    render(<OrganizationsSidebarList {...baseProps()} organizations={[]} totalCount={0} />);
    expect(screen.getByText("No organizations found")).toBeTruthy();
    expect(screen.queryByText("Acme Inc")).toBeNull();
  });

  it("invokes onSelect with the clicked organization", () => {
    const props = baseProps();
    render(<OrganizationsSidebarList {...props} />);
    fireEvent.click(screen.getByText("Globex"));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect.mock.calls[0][0].itemId).toBe("org-2");
  });

  it("renders skeletons and hides the footer while loading", () => {
    render(<OrganizationsSidebarList {...baseProps()} isLoading />);
    expect(screen.queryByText("Acme Inc")).toBeNull();
    expect(screen.queryByText(/Showing 1 to/)).toBeNull();
  });

  it("clears the search when the clear button is pressed", () => {
    const props = baseProps();
    render(<OrganizationsSidebarList {...props} />);
    const input = screen.getByPlaceholderText("Search organizations...");
    fireEvent.change(input, { target: { value: "acme" } });
    const clear = screen.getByLabelText("Clear search");
    fireEvent.click(clear);
    expect(props.onSearchChange).toHaveBeenCalledWith("");
  });

  it("debounces the search and reports only the final keystroke", () => {
    vi.useFakeTimers();
    const props = baseProps();
    render(<OrganizationsSidebarList {...props} />);
    const input = screen.getByPlaceholderText("Search organizations...");

    fireEvent.change(input, { target: { value: "ac" } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(input, { target: { value: "acme" } });
    expect(props.onSearchChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(props.onSearchChange).toHaveBeenCalledTimes(1);
    expect(props.onSearchChange).toHaveBeenCalledWith("acme");
  });

  it("omits the updated label when the organization has no update date", () => {
    render(
      <OrganizationsSidebarList
        {...baseProps()}
        organizations={[makeOrg({ itemId: "org-1", name: "Acme Inc", lastUpdatedDate: undefined })]}
        totalCount={1}
      />,
    );
    expect(screen.getByText("Acme Inc")).toBeTruthy();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it("omits the updated label when the update date cannot be parsed", () => {
    render(
      <OrganizationsSidebarList
        {...baseProps()}
        organizations={[makeOrg({ itemId: "org-1", name: "Acme Inc", lastUpdatedDate: "not-a-date" })]}
        totalCount={1}
      />,
    );
    expect(screen.getByText("Acme Inc")).toBeTruthy();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });

  it("renders the organization logo when one is set", () => {
    const { container } = render(
      <OrganizationsSidebarList
        {...baseProps()}
        organizations={[
          makeOrg({ itemId: "org-1", name: "Acme Inc", logoUrl: "https://cdn.test/acme.png" }),
        ]}
        totalCount={1}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/acme.png");
    expect(img?.getAttribute("alt")).toBe("Acme Inc");
  });

  it("uses the singular noun when there is exactly one organization", () => {
    render(
      <OrganizationsSidebarList
        {...baseProps()}
        organizations={[makeOrg({ itemId: "org-1" })]}
        totalCount={1}
      />,
    );
    expect(screen.getByText(/Showing 1 to 1 of 1 organization$/)).toBeTruthy();
  });

  it("loads the next page when the sentinel scrolls into view", () => {
    const props = baseProps();
    render(<OrganizationsSidebarList {...props} hasMore />);
    act(() => intersect?.([{ isIntersecting: true }]));
    expect(props.onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("does not load more while a page is already in flight or there is nothing left", () => {
    const loadingProps = baseProps();
    const { unmount } = render(
      <OrganizationsSidebarList {...loadingProps} hasMore isLoadingMore />,
    );
    act(() => intersect?.([{ isIntersecting: true }]));
    expect(loadingProps.onLoadMore).not.toHaveBeenCalled();
    unmount();
    expect(disconnected).toBeGreaterThan(0);

    const exhaustedProps = baseProps();
    render(<OrganizationsSidebarList {...exhaustedProps} hasMore={false} />);
    act(() => intersect?.([{ isIntersecting: true }]));
    expect(exhaustedProps.onLoadMore).not.toHaveBeenCalled();
  });

  it("ignores an intersection entry that is not intersecting", () => {
    const props = baseProps();
    render(<OrganizationsSidebarList {...props} hasMore />);
    act(() => intersect?.([{ isIntersecting: false }]));
    expect(props.onLoadMore).not.toHaveBeenCalled();
  });

  it("shows the extra skeleton row while the next page loads", () => {
    const { container } = render(<OrganizationsSidebarList {...baseProps()} isLoadingMore />);
    expect(screen.getByText("Acme Inc")).toBeTruthy();
    expect(container.querySelectorAll(".h-\\[62px\\]").length).toBe(1);
  });

  it("filters the list by status through the filter popover", async () => {
    const user = userEvent.setup();
    render(
      <OrganizationsSidebarList
        {...baseProps()}
        organizations={[
          makeOrg({ itemId: "org-1", name: "Acme Inc", isDisabled: false }),
          makeOrg({ itemId: "org-2", name: "Globex", isDisabled: true }),
        ]}
        totalCount={2}
      />,
    );

    await user.click(screen.getByLabelText("Filter organizations"));
    const activeCheckbox = (await screen.findByText("active")).previousElementSibling as HTMLElement;
    await user.click(activeCheckbox);

    await waitFor(() => expect(screen.queryByText("Acme Inc")).toBeNull());
    expect(screen.getByText("Globex")).toBeTruthy();
  });
});
