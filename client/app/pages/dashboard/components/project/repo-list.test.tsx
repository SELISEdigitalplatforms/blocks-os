import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnvRepository, IProject } from "@seliseblocks/genesis-os/models";

// The point of this file is the REAL ProjectRepoList: the synthetic parent in
// repo-table.test.tsx proves the pattern, but only this proves the component that ships.
const h = vi.hoisted(() => ({ isFetching: false, isLoading: false }));

vi.mock("@/hooks/use-project", () => ({
  useGetEnvRepositories: () => ({
    data: { data: h.repositories, errors: null, isSuccess: true },
    isLoading: h.isLoading,
    isFetching: h.isFetching,
  }),
}));

vi.mock("@seliseblocks/genesis-os", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});

vi.mock("@seliseblocks/genesis-os/components", () => ({
  DashboardSectionCard: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("@seliseblocks/genesis-os/utils", () => ({ formatFullDate: () => "FMT-DATE" }));
vi.mock("../custom-domain/dialog", () => ({ SetCustomDomainDialog: () => null }));

import { ProjectRepoList } from "./repo-list";

const repositories = Array.from({ length: 12 }, (_item, index) => ({
  repoName: `repo-${index + 1}`,
  defaultDeploymentUrl: `repo-${index + 1}.default.dev`,
  customDeploymentUrl: "",
  lastDeploymentDate: "2024-06-01T10:00:00",
})) as unknown as IEnvRepository[];

// Assigned onto the hoisted holder so the mock factory (hoisted above this file's body)
// can reach it.
(h as unknown as { repositories: IEnvRepository[] }).repositories = repositories;

const project = {
  tenantId: "tenant-1",
  environment: "dev",
  applications: [],
} as unknown as IProject;

const paginationNav = () => screen.getByRole("navigation", { name: /pagination/i });
const pageIndicator = () => within(paginationNav()).getByText(/^Page \d+ of \d+$/);
const nextButton = () => {
  const buttons = within(paginationNav()).getAllByRole("button") as HTMLButtonElement[];
  expect(buttons).toHaveLength(4);
  return buttons[2];
};

describe("ProjectRepoList", () => {
  beforeEach(() => {
    h.isFetching = false;
    h.isLoading = false;
    vi.clearAllMocks();
  });

  it("holds the reader's page across a background refetch", async () => {
    // repo-list swaps the entire table for a skeleton while isFetching is true, which
    // unmounts ProjectRepoTable. The page index lives here precisely so that survives.
    const user = userEvent.setup();
    const { rerender } = render(<ProjectRepoList project={project} isLoading={false} />);

    await user.click(nextButton());
    expect(pageIndicator().textContent).toBe("Page 2 of 3");

    // isLoading stays FALSE: the hook's isFetching must be what selects the skeleton,
    // otherwise dropping isFetchingEnvRepos from that gate would still pass this test.
    h.isFetching = true;
    rerender(<ProjectRepoList project={project} isLoading={false} />);
    expect(screen.queryByRole("navigation", { name: /pagination/i })).toBeNull();

    h.isFetching = false;
    rerender(<ProjectRepoList project={project} isLoading={false} />);

    expect(pageIndicator().textContent).toBe("Page 2 of 3");
    expect(screen.getByText("repo-6")).toBeTruthy();
    expect(screen.queryByText("repo-1")).toBeNull();
  });

  it("shows the first page on a fresh mount", () => {
    render(<ProjectRepoList project={project} isLoading={false} />);
    expect(pageIndicator().textContent).toBe("Page 1 of 3");
    expect(screen.getByText("repo-1")).toBeTruthy();
  });
});
