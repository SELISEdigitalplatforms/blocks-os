import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { IEnvRepository } from "@seliseblocks/genesis-os/models";

vi.mock("@seliseblocks/genesis-os/utils", () => ({
  formatFullDate: () => "FMT-DATE",
}));

vi.mock("@/components/ui-kits/tooltip/tooltip", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});

vi.mock("../custom-domain/dialog", () => ({
  SetCustomDomainDialog: ({ open, repo }: { open: boolean; repo: IEnvRepository | null }) =>
    open ? <div data-testid="domain-dialog">dialog:{repo?.repoName}</div> : null,
}));

import { ProjectRepoTable } from "./repo-table";

const repo = (over: Partial<IEnvRepository> = {}): IEnvRepository =>
  ({
    repoName: "web-app",
    defaultDeploymentUrl: "web.default.dev",
    customDeploymentUrl: "",
    lastDeploymentDate: "2024-06-01T10:00:00",
    ...over,
  }) as IEnvRepository;

/** Mirrors production: the page index lives in the parent (ProjectRepoList), because the
 *  table itself is unmounted and remounted on every background refetch. */
const RepoTableHarness = ({ data }: { data: IEnvRepository[] }) => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const handleSearchChange = (value: string) => {
    setPage(0);
    setSearch(value);
  };
  return (
    <ProjectRepoTable
      data={data}
      domains={[]}
      projectKey="pk"
      projectEnv="dev"
      page={page}
      onPageChange={setPage}
      search={search}
      onSearchChange={handleSearchChange}
    />
  );
};

const renderTable = (data: IEnvRepository[]) => render(<RepoTableHarness data={data} />);

describe("ProjectRepoTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an empty message when there are no repositories", () => {
    renderTable([]);
    expect(screen.getByText("No repositories found for this project.")).toBeTruthy();
  });

  it("renders repo name, deployment domain and formatted last deployment date", () => {
    renderTable([repo()]);
    expect(screen.getByText("web-app")).toBeTruthy();
    expect(screen.getByText("web.default.dev")).toBeTruthy();
    expect(screen.getByText("FMT-DATE")).toBeTruthy();
  });

  it("shows 'Not deployed' for the sentinel and empty deployment dates", () => {
    renderTable([
      repo({ repoName: "a", lastDeploymentDate: "0001-01-01T00:00:00" }),
      repo({ repoName: "b", lastDeploymentDate: "" }),
    ]);
    expect(screen.getAllByText("Not deployed").length).toBe(2);
  });

  it("renders a Set button and opens the dialog for a repo without a custom domain", async () => {
    const user = userEvent.setup();
    renderTable([repo({ repoName: "no-domain", customDeploymentUrl: "" })]);
    await user.click(screen.getByRole("button", { name: "Set" }));
    expect(screen.getByTestId("domain-dialog").textContent).toContain("no-domain");
  });

  it("shows the custom domain and enables the edit action when one is set", async () => {
    const user = userEvent.setup();
    renderTable([repo({ repoName: "has-domain", customDeploymentUrl: "custom.example.com" })]);
    expect(screen.getByText("custom.example.com")).toBeTruthy();
    const editButton = screen.getByRole("button", { name: /edit custom domain/i });
    expect((editButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(editButton);
    expect(screen.getByTestId("domain-dialog").textContent).toContain("has-domain");
  });

  it("disables the edit action for a repo without a custom domain", () => {
    renderTable([repo({ customDeploymentUrl: "" })]);
    const editButton = screen.getByRole("button", { name: /edit custom domain/i });
    expect((editButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides search when there are no repositories", () => {
    renderTable([]);
    expect(screen.queryByPlaceholderText("Search repositories...")).toBeNull();
  });

  it("aligns the search field to the left of the table", () => {
    renderTable([repo()]);
    const search = screen.getByPlaceholderText("Search repositories...");
    expect(search.parentElement?.parentElement?.className).toContain("justify-start");
    expect(search.className).toContain("w-64");
  });

  it("filters repository names by case-insensitive substring without changing source data", async () => {
    const user = userEvent.setup();
    const data = [repo({ repoName: "Web-App" }), repo({ repoName: "api-service" })];
    renderTable(data);

    await user.type(screen.getByPlaceholderText("Search repositories..."), "WEB");
    await waitFor(() => expect(visibleRepos()).toEqual(["Web-App"]));
    expect(data).toHaveLength(2);
    expect(pageIndicator().textContent).toBe("Page 1 of 1");
  });

  it("shows a distinct no-match state without pagination", async () => {
    const user = userEvent.setup();
    renderTable([repo()]);

    await user.type(screen.getByPlaceholderText("Search repositories..."), "missing");
    expect(await screen.findByText("No repositories match your search.")).toBeTruthy();
    expect(screen.queryByText("No repositories found for this project.")).toBeNull();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
  });

  it("resets pagination on search and restores page one when cleared", async () => {
    const user = userEvent.setup();
    renderTable(manyRepos(12));
    await user.click(navButtons().next);
    expect(pageIndicator().textContent).toBe("Page 2 of 3");

    const input = screen.getByPlaceholderText("Search repositories...");
    await user.type(input, "REPO-12");
    await waitFor(() => expect(visibleRepos()).toEqual(["repo-12"]));
    expect(pageIndicator().textContent).toBe("Page 1 of 1");

    const clearButton = within(input.parentElement as HTMLElement).getByRole("button");
    await user.click(clearButton);
    await waitFor(() => expect(visibleRepos()).toEqual(repoNames(5)));
    expect(pageIndicator().textContent).toBe("Page 1 of 3");
  });

  it("keeps row actions attached to the filtered repository", async () => {
    const user = userEvent.setup();
    renderTable(manyRepos(12));
    await user.type(screen.getByPlaceholderText("Search repositories..."), "repo-12");
    await waitFor(() => expect(visibleRepos()).toEqual(["repo-12"]));

    await user.click(screen.getByRole("button", { name: "Set" }));
    expect(screen.getByTestId("domain-dialog").textContent).toContain("repo-12");
  });
});

// --- Pagination (#471) ------------------------------------------------------

const manyRepos = (count: number) =>
  Array.from({ length: count }, (_item, index) => repo({ repoName: `repo-${index + 1}` }));

const repoNames = (count: number, from = 1) =>
  Array.from({ length: count }, (_item, index) => `repo-${from + index}`);

/** The first cell of every rendered body row - the repository name column. */
const visibleRepos = () =>
  Array.from(document.querySelectorAll("tbody tr")).map(
    (row) => row.querySelector("td")?.textContent?.trim() ?? "",
  );

/** The pagination landmark. Asserting on it also proves the control is labelled. */
const paginationNav = () => screen.getByRole("navigation", { name: /pagination/i });

const pageIndicator = () => within(paginationNav()).getByText(/^Page \d+ of \d+$/);

/** The four navigation buttons, in the order the shared control renders them. They are
 *  icon-only with no accessible name, so position is the only handle; the length
 *  assertion makes a change in the shared control fail loudly here. */
const navButtons = () => {
  const buttons = within(paginationNav()).getAllByRole("button") as HTMLButtonElement[];
  expect(buttons).toHaveLength(4);
  const [first, previous, next, last] = buttons;
  return { first, previous, next, last };
};

describe("ProjectRepoTable pagination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders only the first five of eight repositories", () => {
    renderTable(manyRepos(8));
    expect(visibleRepos()).toEqual(repoNames(5));
    expect(pageIndicator().textContent).toBe("Page 1 of 2");
  });

  it("moves to the next page", async () => {
    const user = userEvent.setup();
    renderTable(manyRepos(12));
    await user.click(navButtons().next);
    expect(visibleRepos()).toEqual(repoNames(5, 6));
    expect(pageIndicator().textContent).toBe("Page 2 of 3");
  });

  it("jumps to the last page, back one, and home again", async () => {
    const user = userEvent.setup();
    renderTable(manyRepos(12));

    await user.click(navButtons().last);
    expect(visibleRepos()).toEqual(repoNames(2, 11));
    expect(pageIndicator().textContent).toBe("Page 3 of 3");

    await user.click(navButtons().previous);
    expect(visibleRepos()).toEqual(repoNames(5, 6));

    await user.click(navButtons().first);
    expect(visibleRepos()).toEqual(repoNames(5));
    expect(pageIndicator().textContent).toBe("Page 1 of 3");
  });

  it("cannot go back from the first page", () => {
    renderTable(manyRepos(12));
    const { first, previous } = navButtons();
    expect(first.disabled).toBe(true);
    expect(previous.disabled).toBe(true);
  });

  it("keeps exactly five repositories on a single page", () => {
    renderTable(manyRepos(5));
    expect(visibleRepos()).toEqual(repoNames(5));
    expect(pageIndicator().textContent).toBe("Page 1 of 1");
    const { next, last } = navButtons();
    expect(next.disabled).toBe(true);
    expect(last.disabled).toBe(true);
  });

  it("still shows a single-page control for fewer than five repositories", () => {
    // A `data.length >= 5` gate would hide the control here and pass every other case.
    renderTable(manyRepos(3));
    expect(visibleRepos()).toEqual(repoNames(3));
    expect(pageIndicator().textContent).toBe("Page 1 of 1");
    const { next, last } = navButtons();
    expect(next.disabled).toBe(true);
    expect(last.disabled).toBe(true);
  });

  it("renders no pagination control at all when there are no repositories", () => {
    renderTable([]);
    expect(screen.getByText("No repositories found for this project.")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();
  });

  it("clamps to the last page that still exists when the data shrinks", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RepoTableHarness data={manyRepos(12)} />);
    await user.click(navButtons().last);
    expect(pageIndicator().textContent).toBe("Page 3 of 3");

    rerender(<RepoTableHarness data={manyRepos(6)} />);

    // TanStack queues its auto-reset in a microtask; flush it (and the render it
    // would cause) so this assertion can actually see a page that moved.
    await act(async () => {});

    // Neither "Page 1 of 2" (an auto-reset to the start) nor "Page 3 of 2" (no clamp,
    // blank body).
    expect(pageIndicator().textContent).toBe("Page 2 of 2");
    expect(visibleRepos()).toEqual(repoNames(1, 6));
  });

  it("keeps the current page when a refetch replaces the data", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RepoTableHarness data={manyRepos(12)} />);
    await user.click(navButtons().next);
    expect(pageIndicator().textContent).toBe("Page 2 of 3");

    // A background refetch hands down an equal but brand-new array. Nothing the reader
    // is looking at has changed, so the page must not move under them.
    rerender(<RepoTableHarness data={manyRepos(12)} />);

    // TanStack queues its auto-reset in a microtask; flush it (and the render it
    // would cause) so this assertion can actually see a page that moved.
    await act(async () => {});

    expect(pageIndicator().textContent).toBe("Page 2 of 3");
    expect(visibleRepos()).toEqual(repoNames(5, 6));
  });

  it("offers no rows-per-page selector", () => {
    renderTable(manyRepos(12));
    expect(screen.queryByText("Rows per page")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("fires a row action for the row shown on page two", async () => {
    const user = userEvent.setup();
    renderTable(manyRepos(12));
    await user.click(navButtons().next);
    // First visible row on page 2 is the sixth repository - an action wired to the raw
    // data array instead of the row model would open the first one.
    await user.click(screen.getAllByRole("button", { name: "Set" })[0]);
    expect(screen.getByTestId("domain-dialog").textContent).toContain("repo-6");
  });

  it("survives the remount its parent causes on a background refetch", async () => {
    // repo-list.tsx swaps the whole table for a skeleton whenever the repositories are
    // refetching, so page state held inside the table would be lost. This stands in for
    // that parent: unmount the table, bring it back, and the page must hold.
    const user = userEvent.setup();
    const Parent = ({ hidden, data }: { hidden: boolean; data: IEnvRepository[] }) => {
      const [page, setPage] = useState(0);
      const [search, setSearch] = useState("");
      if (hidden) return <div data-testid="skeleton" />;
      return (
        <ProjectRepoTable
          data={data}
          domains={[]}
          projectKey="pk"
          projectEnv="dev"
          page={page}
          onPageChange={setPage}
          search={search}
          onSearchChange={setSearch}
        />
      );
    };

    const data = manyRepos(12);
    const { rerender } = render(<Parent hidden={false} data={data} />);
    await user.click(navButtons().next);
    expect(pageIndicator().textContent).toBe("Page 2 of 3");

    rerender(<Parent hidden data={data} />);
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    rerender(<Parent hidden={false} data={data} />);

    expect(pageIndicator().textContent).toBe("Page 2 of 3");
    expect(visibleRepos()).toEqual(repoNames(5, 6));
  });
});
