import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { useGetGithubRepos, revokeAccess } = vi.hoisted(() => ({
  useGetGithubRepos: vi.fn(),
  revokeAccess: vi.fn(),
}));

vi.mock("@/cross-modules/devops/hooks/github-info", () => ({
  useGetGithubRepos,
}));

vi.mock("@/cross-modules/devops/services/github-info.service", () => ({
  githubInfoService: { revokeAccess },
}));

import { RepositorySelectionModal } from "./repository-selection-modal";
import type { IRepository } from "@/cross-modules/devops/models/github-info";

// jsdom does not implement scrollIntoView, which the highlight effect calls.
Element.prototype.scrollIntoView = vi.fn();

const makeRepo = (id: number): IRepository => ({
  id,
  name: `repo-${id}`,
  full_name: `org/repo-${id}`,
  html_url: `https://github.com/org/repo-${id}`,
});

const queryResult = (
  items: IRepository[],
  total: number,
  overrides: Partial<{ isLoading: boolean; isFetching: boolean }> = {},
) => ({
  data: { data: { items, total_count: total } },
  isLoading: false,
  isFetching: false,
  ...overrides,
});

const setup = (props: Partial<React.ComponentProps<typeof RepositorySelectionModal>> = {}) => {
  const onOpenChange = vi.fn();
  const onSelectRepository = vi.fn();
  render(
    <RepositorySelectionModal
      open
      onOpenChange={onOpenChange}
      onSelectRepository={onSelectRepository}
      {...props}
    />,
  );
  return { onOpenChange, onSelectRepository };
};

describe("RepositorySelectionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetGithubRepos.mockReturnValue(queryResult([makeRepo(1), makeRepo(2)], 2));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the default title, description and provider list", () => {
    setup();
    expect(screen.getByText("Select repository")).toBeTruthy();
    expect(
      screen.getByText("Select the repositories you want to link to this project"),
    ).toBeTruthy();
    // github result count is shown
    expect(screen.getByText(/2 results/)).toBeTruthy();
  });

  it("honours custom title and description props", () => {
    setup({ title: "Pick one", description: "custom desc" });
    expect(screen.getByText("Pick one")).toBeTruthy();
    expect(screen.getByText("custom desc")).toBeTruthy();
  });

  it("opens the popover and lists the repositories", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByPlaceholderText("Search repositories...")).toBeTruthy();
    expect(screen.getByText("org/repo-1")).toBeTruthy();
    expect(screen.getByText("org/repo-2")).toBeTruthy();
  });

  it("selects a repository and adds it", async () => {
    const user = userEvent.setup();
    const { onSelectRepository } = setup();
    await user.click(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByText("org/repo-1"));
    const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    await user.click(add);
    expect(onSelectRepository).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it("shows an error when the repository is already selected", async () => {
    const user = userEvent.setup();
    setup({ selectedRepositories: [makeRepo(1)] });
    await user.click(screen.getByRole("combobox"));
    fireEvent.mouseDown(screen.getByText("org/repo-1"));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Repository already selected.")).toBeTruthy();
  });

  it("shows an empty state when no repositories are returned", async () => {
    useGetGithubRepos.mockReturnValue(queryResult([], 0));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("No repositories found.")).toBeTruthy();
  });

  it("supports keyboard navigation and selection with Enter", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    const container = screen.getByPlaceholderText("Search repositories...");
    fireEvent.keyDown(container, { key: "ArrowDown" });
    fireEvent.keyDown(container, { key: "ArrowUp" });
    fireEvent.keyDown(container, { key: "Enter" });
    // popover closes and selected value shows in the trigger
    await waitFor(() => expect(screen.queryByPlaceholderText("Search repositories...")).toBeNull());
  });

  it("closes the popover on Escape", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    const search = screen.getByPlaceholderText("Search repositories...");
    fireEvent.keyDown(search, { key: "Escape" });
    await waitFor(() => expect(screen.queryByPlaceholderText("Search repositories...")).toBeNull());
  });

  it("debounces search input and resets pagination", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    const search = screen.getByPlaceholderText("Search repositories...");
    fireEvent.change(search, { target: { value: "abc" } });
    // after the 500ms debounce elapses, the hook is re-invoked with the term
    await waitFor(() => expect(useGetGithubRepos).toHaveBeenCalledWith(true, "abc", 1, 10), {
      timeout: 2000,
    });
  });

  it("cancels and calls onOpenChange(false)", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens the revoke access confirmation and confirms it", async () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload },
      writable: true,
    });
    revokeAccess.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("Revoke repository access"));
    expect(await screen.findByText("Revoke Access")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(revokeAccess).toHaveBeenCalled());
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("loads more repositories on scroll when more data is available", async () => {
    const firstPage = Array.from({ length: 10 }, (_, i) => makeRepo(i + 1));
    useGetGithubRepos.mockReturnValue(queryResult(firstPage, 25));
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("combobox"));
    const list = screen.getByText("org/repo-1").closest("div[class*='overflow-y-auto']");
    expect(list).toBeTruthy();
    fireEvent.scroll(list as Element, { target: { scrollTop: 1000 } });
    // page increments -> hook re-invoked with page 2
    await waitFor(() =>
      expect(useGetGithubRepos).toHaveBeenCalledWith(true, undefined, 2, 10),
    );
  });

  it("shows the loading state in the trigger while fetching", () => {
    useGetGithubRepos.mockReturnValue(queryResult([], 0, { isLoading: true }));
    setup();
    expect(screen.getByText("Loading repositories...")).toBeTruthy();
  });
});
