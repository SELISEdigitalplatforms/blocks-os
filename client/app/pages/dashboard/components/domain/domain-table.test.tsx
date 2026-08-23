import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsync, showErrorToast, showSuccessToast } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/hooks/use-project", () => ({
  useUpdateProject: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@seliseblocks/genesis-os/utils", () => ({ showErrorToast, showSuccessToast }));
vi.mock("@seliseblocks/genesis-os/components", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  CopyToClipboardButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  RenderConditionally: ({
    condition,
    children,
  }: {
    condition: boolean;
    children: React.ReactNode;
  }) => (condition ? <>{children}</> : null),
}));
vi.mock("./domain-form-dialog", () => ({
  DomainFormDialog: ({ open }: { open: boolean }) => (
    <div data-testid="domain-form" data-open={String(open)} />
  ),
}));
vi.mock("../cname/dialog", () => ({
  CnameValidatorDialog: ({ open, domain }: { open: boolean; domain?: { domain: string } }) => (
    <div data-testid="cname-dialog" data-open={String(open)} data-domain={domain?.domain ?? ""} />
  ),
}));

import { DomainTable } from "./domain-table";
import type { IDomain } from "@seliseblocks/genesis-os/models";

const domains = [
  { domain: "verified.com", isDomainVerified: true, cookieDomain: ".verified.com" },
  { domain: "pending.com", isDomainVerified: false, cookieDomain: ".pending.com" },
] as unknown as IDomain[];

describe("DomainTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row per domain with status badges", () => {
    render(<DomainTable data={domains} />);
    expect(screen.getByText("verified.com")).toBeTruthy();
    expect(screen.getByText("pending.com")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText("Unverified")).toBeTruthy();
  });

  it("aligns the search field to the left of the table", () => {
    render(<DomainTable data={domains} />);
    const search = screen.getByPlaceholderText("Search domains...");
    expect(search.parentElement?.parentElement?.className).toContain("justify-start");
    expect(search.className).toContain("w-64");
  });

  it("renders an empty state when there are no domains", () => {
    render(<DomainTable data={[]} />);
    expect(screen.getByText("No domains configured yet.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search domains...")).toBeNull();
  });

  it("filters domain names by case-insensitive substring without changing source data", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);

    await user.type(screen.getByPlaceholderText("Search domains..."), "VERIFIED");
    await waitFor(() => expect(visibleDomains()).toEqual(["verified.com"]));
    expect(domains).toHaveLength(2);
    expect(pageIndicator().textContent).toBe("Page 1 of 1");
  });

  it("shows a distinct no-match state without pagination", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);

    await user.type(screen.getByPlaceholderText("Search domains..."), "missing");
    expect(await screen.findByText("No domains match your search.")).toBeTruthy();
    expect(screen.queryByText("No domains configured yet.")).toBeNull();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
  });

  it("keeps row actions attached to the filtered domain", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.type(screen.getByPlaceholderText("Search domains..."), "pending");
    await waitFor(() => expect(visibleDomains()).toEqual(["pending.com"]));

    await user.click(screen.getByTitle("Validate CNAME"));
    expect(screen.getByTestId("cname-dialog").getAttribute("data-domain")).toBe("pending.com");
  });

  it("only shows configure and CNAME actions for unverified domains", () => {
    render(<DomainTable data={domains} />);
    // one Configure and one Validate CNAME (for pending.com only)
    expect(screen.getAllByTitle("Configure domain")).toHaveLength(1);
    expect(screen.getAllByTitle("Validate CNAME")).toHaveLength(1);
    // both rows have a delete button
    expect(screen.getAllByTitle("Delete domain")).toHaveLength(2);
  });

  it("opens the edit dialog when configure is clicked", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getByTitle("Configure domain"));
    expect(screen.getByTestId("domain-form").getAttribute("data-open")).toBe("true");
  });

  it("opens the CNAME dialog with the resolved domain", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getByTitle("Validate CNAME"));
    expect(screen.getByTestId("cname-dialog").getAttribute("data-open")).toBe("true");
    expect(screen.getByTestId("cname-dialog").getAttribute("data-domain")).toBe("pending.com");
  });

  it("deletes a domain after confirmation and shows a success toast", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ action: 2, applicationDomain: "verified.com" }),
      ),
    );
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it("keeps the shared API host unless the option is ticked", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ deleteSharedApiHost: false }),
      ),
    );
  });

  it("removes the shared API host when the option is ticked", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ deleteSharedApiHost: true }),
      ),
    );
  });

  it("names the shared API host and who it affects", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    expect(await screen.findByText("blocksapi.verified.com")).toBeTruthy();
    expect(screen.getByText(/other projects you may not be able to see/)).toBeTruthy();
  });

  it("states that the certificate is removed rather than asking", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    expect(await screen.findByText(/SSL certificate are removed from the proxy/)).toBeTruthy();
  });

  it("does not offer the shared API host option for an unverified domain", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    // Second row is pending.com — nothing was ever put on the proxy for it.
    await user.click(screen.getAllByTitle("Delete domain")[1]);
    await screen.findByRole("button", { name: "Delete" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("does not offer the shared API host option for a platform-hosted domain", async () => {
    const user = userEvent.setup();
    const platform = [
      { domain: "https://xyz.slsblx.com", isDomainVerified: true, cookieDomain: "slsblx.com" },
    ] as unknown as IDomain[];
    render(<DomainTable data={platform} />);
    await user.click(screen.getByTitle("Delete domain"));
    await screen.findByRole("button", { name: "Delete" });
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("resets the shared API host choice between domains", async () => {
    mutateAsync.mockResolvedValue({ isSuccess: true });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);

    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // A box ticked for one domain must not carry over to the next one deleted.
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    expect((await screen.findByRole("checkbox")).getAttribute("data-state")).toBe("unchecked");
  });

  it("shows an error toast when deletion returns a failure", async () => {
    mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "no" } });
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });

  it("shows an error toast when deletion throws", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    render(<DomainTable data={domains} />);
    await user.click(screen.getAllByTitle("Delete domain")[0]);
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Failed to delete domain" }),
    );
  });
});

// ─── Pagination (#471) ────────────────────────────────────────────────────────

const manyDomains = (count: number) =>
  Array.from({ length: count }, (_item, index) => ({
    domain: `domain-${index + 1}.com`,
    isDomainVerified: false,
    cookieDomain: `.domain-${index + 1}.com`,
  })) as unknown as IDomain[];

const names = (count: number, from = 1) =>
  Array.from({ length: count }, (_item, index) => `domain-${from + index}.com`);

/** The first cell of every rendered body row — the domain column. */
const visibleDomains = () =>
  Array.from(document.querySelectorAll("tbody tr")).map(
    (row) => row.querySelector("td")?.textContent?.trim() ?? "",
  );

/** The pagination landmark. Asserting on it also proves the control is labelled. */
const paginationNav = () => screen.getByRole("navigation", { name: /pagination/i });

const pageIndicator = () => within(paginationNav()).getByText(/^Page \d+ of \d+$/);

/** The four navigation buttons, in the order the shared control renders them.
 *  They are icon-only and carry no accessible name, so position is the only handle;
 *  the length assertion makes a change in the shared control fail here loudly rather
 *  than quietly clicking the wrong button. */
const navButtons = () => {
  const buttons = within(paginationNav()).getAllByRole("button") as HTMLButtonElement[];
  expect(buttons).toHaveLength(4);
  const [first, previous, next, last] = buttons;
  return { first, previous, next, last };
};

describe("DomainTable pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders only the first five of twelve domains", () => {
    render(<DomainTable data={manyDomains(12)} />);
    expect(visibleDomains()).toEqual(names(5));
    expect(pageIndicator().textContent).toBe("Page 1 of 3");
  });

  it("moves to the next page", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={manyDomains(12)} />);
    await user.click(navButtons().next);
    expect(visibleDomains()).toEqual(names(5, 6));
    expect(pageIndicator().textContent).toBe("Page 2 of 3");
  });

  it("resets pagination on search and restores page one when cleared", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={manyDomains(12)} />);
    await user.click(navButtons().next);
    expect(pageIndicator().textContent).toBe("Page 2 of 3");

    const input = screen.getByPlaceholderText("Search domains...");
    await user.type(input, "DOMAIN-12");
    await waitFor(() => expect(visibleDomains()).toEqual(["domain-12.com"]));
    expect(pageIndicator().textContent).toBe("Page 1 of 1");

    const clearButton = within(input.parentElement as HTMLElement).getByRole("button");
    await user.click(clearButton);
    await waitFor(() => expect(visibleDomains()).toEqual(names(5)));
    expect(pageIndicator().textContent).toBe("Page 1 of 3");
  });

  it("jumps to the last page, back one, and home again", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={manyDomains(12)} />);

    await user.click(navButtons().last);
    expect(visibleDomains()).toEqual(names(2, 11));
    expect(pageIndicator().textContent).toBe("Page 3 of 3");

    await user.click(navButtons().previous);
    expect(visibleDomains()).toEqual(names(5, 6));

    await user.click(navButtons().first);
    expect(visibleDomains()).toEqual(names(5));
    expect(pageIndicator().textContent).toBe("Page 1 of 3");
  });

  it("cannot go back from the first page", () => {
    render(<DomainTable data={manyDomains(12)} />);
    const { first, previous } = navButtons();
    expect(first.disabled).toBe(true);
    expect(previous.disabled).toBe(true);
  });

  it("keeps exactly five domains on a single page", () => {
    render(<DomainTable data={manyDomains(5)} />);
    expect(visibleDomains()).toEqual(names(5));
    expect(pageIndicator().textContent).toBe("Page 1 of 1");
    const { next, last } = navButtons();
    expect(next.disabled).toBe(true);
    expect(last.disabled).toBe(true);
  });

  it("still shows a single-page control for fewer than five domains", () => {
    // A `data.length >= 5` gate would hide the control here and pass every other case.
    render(<DomainTable data={manyDomains(3)} />);
    expect(visibleDomains()).toEqual(names(3));
    expect(pageIndicator().textContent).toBe("Page 1 of 1");
    const { next, last } = navButtons();
    expect(next.disabled).toBe(true);
    expect(last.disabled).toBe(true);
  });

  it("renders no pagination control at all when there are no domains", () => {
    render(<DomainTable data={[]} />);
    expect(screen.getByText("No domains configured yet.")).toBeTruthy();
    // Never "Page 1 of 1" over an empty state.
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
  });

  it("clamps to the last page that still exists when the data shrinks", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DomainTable data={manyDomains(12)} />);
    await user.click(navButtons().last);
    expect(pageIndicator().textContent).toBe("Page 3 of 3");

    rerender(<DomainTable data={manyDomains(6)} />);

    // TanStack queues its auto-reset in a microtask; flush it (and the render it
    // would cause) so this assertion can actually see a page that moved.
    await act(async () => {});

    // Neither "Page 1 of 2" (an auto-reset to the start) nor "Page 3 of 2" (no clamp,
    // blank body). Asserting only that rows render would accept the first of those.
    expect(pageIndicator().textContent).toBe("Page 2 of 2");
    expect(visibleDomains()).toEqual(names(1, 6));
  });

  it("keeps the current page when a refetch replaces the data", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DomainTable data={manyDomains(12)} />);
    await user.click(navButtons().next);
    expect(pageIndicator().textContent).toBe("Page 2 of 3");

    // A background refetch hands down an equal but brand-new array. Nothing the reader
    // is looking at has changed, so the page must not move under them.
    rerender(<DomainTable data={manyDomains(12)} />);

    // TanStack queues its auto-reset in a microtask; flush it (and the render it
    // would cause) so this assertion can actually see a page that moved.
    await act(async () => {});

    expect(pageIndicator().textContent).toBe("Page 2 of 3");
    expect(visibleDomains()).toEqual(names(5, 6));
  });

  it("offers no rows-per-page selector", () => {
    render(<DomainTable data={manyDomains(12)} />);
    expect(screen.queryByText("Rows per page")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("fires a row action for the row shown on page two", async () => {
    const user = userEvent.setup();
    render(<DomainTable data={manyDomains(12)} />);
    await user.click(navButtons().next);
    // First visible row on page 2 is the sixth domain — an action wired to the raw
    // data array instead of the row model would open the first one.
    await user.click(screen.getAllByTitle("Validate CNAME")[0]);
    expect(screen.getByTestId("cname-dialog").getAttribute("data-domain")).toBe("domain-6.com");
  });
});
