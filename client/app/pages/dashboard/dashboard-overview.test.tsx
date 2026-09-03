import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { IDomain, IEnvRepository } from "@seliseblocks/genesis-os/models";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";

// `useGetProject` stays disabled until the impersonation store reports a resolved
// tenant, so that store is stubbed. The package barrels are stubbed the way the rest of
// the suite stubs them: their dist bundle reads `import.meta.env` at module scope, which
// is undefined for an externalised dependency under vitest.
const h = vi.hoisted(() => ({ tenant: "tenant-1" }));

vi.mock("@seliseblocks/genesis-os", () => {
  // The app's own ui-kits/tooltip re-exports these straight from the package barrel, so
  // stubbing the barrel means stubbing them too.
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    useImpersonateStore: () => ({
      isInitialized: true,
      isImpersonated: false,
      impersonatedTenantId: "",
      originalTenantId: h.tenant,
    }),
    useProjectStore: () => ({ setProjects: vi.fn() }),
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
    TooltipProvider: Passthrough,
  };
});

vi.mock("@seliseblocks/genesis-os/components", () => ({
  DashboardSectionCard: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
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

vi.mock("@seliseblocks/genesis-os/utils", () => ({
  formatFullDate: () => "FMT-DATE",
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());

// Dialogs and the sibling header sections are not what this test is about; the tables,
// their hooks and the query client stay real.
vi.mock("./components/domain/domain-form-dialog", () => ({
  DomainFormDialog: () => null,
}));
vi.mock("./components/cname/dialog", () => ({ CnameValidatorDialog: () => null }));
vi.mock("./components/custom-domain/dialog", () => ({ SetCustomDomainDialog: () => null }));
vi.mock("./components/project/overview", () => ({ ProjectOverview: () => null }));
vi.mock("./components/project/actions", () => ({ ProjectActions: () => null }));

import { createWrapper } from "@/test-utils/test-providers/query-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { projectService } from "@/services/project.service";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { DashboardOverview } from "./dashboard-overview";

const applications = Array.from({ length: 12 }, (_item, index) => ({
  domain: `domain-${index + 1}.com`,
  isDomainVerified: false,
  cookieDomain: `.domain-${index + 1}.com`,
})) as unknown as IDomain[];

const repositories = Array.from({ length: 12 }, (_item, index) => ({
  repoName: `repo-${index + 1}`,
  defaultDeploymentUrl: `repo-${index + 1}.default.dev`,
  customDeploymentUrl: "",
  lastDeploymentDate: "2024-06-01T10:00:00",
})) as unknown as IEnvRepository[];

const project = {
  itemId: "project-1",
  name: "Blocks",
  environment: "dev",
  tenantId: "tenant-1",
  createdBy: "someone",
  isDisabled: false,
  applications,
};

/** Next is the third of the four navigation buttons the shared control renders. */
const nextButtonWithin = (indicator: HTMLElement) => {
  const buttons = Array.from(
    indicator.parentElement?.querySelectorAll("button") ?? [],
  ) as HTMLButtonElement[];
  expect(buttons).toHaveLength(4);
  return buttons[2];
};

describe("DashboardOverview pagination (#471)", () => {
  beforeEach(() => {
    h.tenant = "tenant-1";
  });

  it("pages both sections without issuing another request for either list", async () => {
    // Spying on the service singletons rather than on the hooks: a hook-call count is
    // not a request count, and mocking the hooks would make this assertion vacuous.
    const getProject = vi
      .spyOn(projectService, "getProject")
      .mockResolvedValue({ data: project } as never);
    const getEnvRepositories = vi
      .spyOn(crossProjectService, "getEnvRepositories")
      .mockResolvedValue({ data: repositories, errors: null, isSuccess: true });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DashboardOverview />
      </MemoryRouter>,
      { wrapper: createWrapper() },
    );

    // Both sections have loaded, each showing its first page only.
    expect(await screen.findByText("domain-1.com")).toBeTruthy();
    expect(await screen.findByText("repo-1")).toBeTruthy();
    expect(screen.queryByText("domain-6.com")).toBeNull();
    expect(screen.queryByText("repo-6")).toBeNull();

    expect(getProject).toHaveBeenCalledTimes(1);
    expect(getEnvRepositories).toHaveBeenCalledTimes(1);

    const indicators = screen.getAllByText(/^Page \d+ of \d+$/);
    expect(indicators).toHaveLength(2);

    for (const indicator of indicators) {
      await user.click(nextButtonWithin(indicator));
    }

    expect(await screen.findByText("domain-6.com")).toBeTruthy();
    expect(await screen.findByText("repo-6")).toBeTruthy();

    // The whole point of doing this client side: paging is not a round trip.
    expect(getProject).toHaveBeenCalledTimes(1);
    expect(getEnvRepositories).toHaveBeenCalledTimes(1);

    getProject.mockRestore();
    getEnvRepositories.mockRestore();
  });

  it("does not carry a page index across a project switch", async () => {
    // Both sections hold a page index now. Switching projects reuses the same component
    // positions, so without a key the reader lands on page 2 of a project they just left.
    const projectB = {
      ...project,
      tenantId: "tenant-2",
      name: "Other",
      applications: Array.from({ length: 12 }, (_item, index) => ({
        domain: `other-${index + 1}.com`,
        isDomainVerified: false,
        cookieDomain: `.other-${index + 1}.com`,
      })),
    };

    vi.spyOn(projectService, "getProject").mockImplementation(
      async () => ({ data: h.tenant === "tenant-1" ? project : projectB }) as never,
    );
    vi.spyOn(crossProjectService, "getEnvRepositories").mockResolvedValue({
      data: repositories,
      errors: null,
      isSuccess: true,
    });

    // Seed the second project into the cache. That is the case that actually risks a
    // leak: data resolves synchronously on the switch, so DashboardOverview never returns
    // null and React reuses the mounted sections instead of remounting them. Without a
    // seeded cache this test passes even with the keys removed - the null gap resets the
    // page for unrelated reasons and proves nothing.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["identifier", "project", "tenant-2"], { data: projectB });
    queryClient.setQueryData(["env-repositories", "tenant-2"], {
      data: repositories,
      errors: null,
      isSuccess: true,
    });

    const user = userEvent.setup();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardOverview />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("domain-1.com")).toBeTruthy();
    expect(await screen.findByText("repo-1")).toBeTruthy();

    // BOTH sections are advanced: paging only Domains would let the repositories key
    // be removed without failing anything.
    const nextIn = (name: RegExp) => {
      const nav = screen.getAllByRole("navigation", { name })[0];
      return (within(nav).getAllByRole("button") as HTMLButtonElement[])[2];
    };
    await user.click(nextIn(/domains pagination/i));
    await user.click(nextIn(/repositories pagination/i));
    expect(await screen.findByText("domain-6.com")).toBeTruthy();
    expect(await screen.findByText("repo-6")).toBeTruthy();

    h.tenant = "tenant-2";
    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardOverview />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Both sections start the new project on their own first page, not on page 2.
    expect(await screen.findByText("other-1.com")).toBeTruthy();
    expect(screen.queryByText("other-6.com")).toBeNull();
    expect(await screen.findByText("repo-1")).toBeTruthy();
    expect(screen.queryByText("repo-6")).toBeNull();

    const indicatorIn = (name: RegExp) =>
      within(screen.getAllByRole("navigation", { name })[0]).getByText(/^Page \d+ of \d+$/)
        .textContent;
    expect(indicatorIn(/domains pagination/i)).toBe("Page 1 of 3");
    expect(indicatorIn(/repositories pagination/i)).toBe("Page 1 of 3");
  });
});
