import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@seliseblocks/genesis-os/store";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  approve: vi.fn(),
  checkReadiness: vi.fn(),
  startImpersonation: vi.fn(),
  createProject: vi.fn(),
  requestQueryResult: undefined as unknown,
  projectsQueryResult: undefined as unknown,
}));

vi.mock("@/cross-modules/integration/services/integration-connect.service", () => ({
  integrationConnectService: {
    getRequest: mocks.getRequest,
    cancel: vi.fn(),
    approve: mocks.approve,
    checkReadiness: mocks.checkReadiness,
  },
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[]; queryFn: () => Promise<unknown> }) => ({
      data: undefined,
      error: null,
      isError: false,
      isLoading: false,
      ...(options.queryKey[0] === "integration-connect" ? mocks.requestQueryResult : mocks.projectsQueryResult),
    }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

// The http error shape the genesis client throws: { status, errors }.
const httpError = (errors: Record<string, string>) =>
  Object.assign(new Error("failed"), { status: 400, errors });

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useStartImpersonation: () => ({ mutateAsync: mocks.startImpersonation }),
}));

vi.mock("@/hooks/use-project", () => ({
  useCreateProject: () => ({ isPending: false, mutateAsync: mocks.createProject }),
}));

const { default: ConnectPage } = await import("./connect");

const setAuthenticated = (value: boolean) =>
  useAuthStore.setState({ isAuthenticated: value } as never);

const mount = (): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/connect?request=req-1"]}>
        <ConnectPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return result;
};

describe("ConnectPage error states (P3-16)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mocks.requestQueryResult = undefined;
    mocks.projectsQueryResult = undefined;
    mocks.approve.mockResolvedValue({ redirectUrl: "https://site.example.com/callback?code=code-1" });
    mocks.startImpersonation.mockResolvedValue(undefined);
    setAuthenticated(true);
    window.history.replaceState(null, "", "/connect?request=req-1");
  });

  it("shows the expired screen with a back-to-site button when the pending entry has callback coordinates", () => {
    mocks.requestQueryResult = { isError: true, error: httpError({ request_not_found_or_expired: "gone" }) };
    window.localStorage.setItem(
      "blocks:pending-integration-request",
      JSON.stringify({
        requestId: "req-1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        redirectUri: "https://site.example.com/callback",
        state: "state-1234567890",
      }),
    );

    const { unmount } = mount();

    expect(screen.getByText("This connection link has expired")).toBeTruthy();
    expect(screen.getAllByAltText("Blocks OS").map((image) => image.getAttribute("src"))).toEqual([
      "/blocks-logos/os_light_mode.svg",
      "/blocks-logos/os_dark_mode.svg",
    ]);
    expect(screen.getByText("Back to your site")).toBeTruthy();
    // Leaving the screen removes the pending id so a later login is not redirected to a
    // dead request — verified after unmount, since the screen itself still needs the data.
    unmount();
    expect(window.localStorage.getItem("blocks:pending-integration-request")).toBeNull();
  });

  it("shows the expired screen without a button when nothing is known about the callback", () => {
    mocks.requestQueryResult = { isError: true, error: httpError({ request_not_found_or_expired: "gone" }) };

    mount();

    expect(screen.getByText("This connection link has expired")).toBeTruthy();
    expect(screen.queryByText("Back to your site")).toBeNull();
  });

  it("explains when another user already holds the request", () => {
    mocks.requestQueryResult = { isError: true, error: httpError({ request_claimed_by_other_user: "taken" }) };

    mount();

    expect(screen.getByText("This connection request is in use")).toBeTruthy();
  });

  it("falls back to a generic message for unexpected errors", () => {
    mocks.requestQueryResult = { isError: true, error: new Error("boom") };

    mount();

    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("goes back from project creation to project selection without cancelling the connection", async () => {
    mocks.requestQueryResult = {
      data: {
        requestId: "req-1",
        siteName: "My Blog",
        redirectHost: "site.example.com",
        family: "localization",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        templates: [],
      },
    };
    mocks.projectsQueryResult = {
      data: [{
        tenantGroupId: "group-1",
        projects: [{ itemId: "project-1", tenantId: "environment-1", environment: "dev", name: "Project" }],
      }],
    };

    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create new project" }));
    expect(screen.getByLabelText("Project name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Go back" }));
    expect(screen.getByRole("combobox", { name: "Project" })).toBeTruthy();
    expect(screen.queryByLabelText("Project name")).toBeNull();
  });

  it("shows project creation success and does not offer the create action again", async () => {
    mocks.requestQueryResult = {
      data: {
        requestId: "req-1",
        siteName: "My Blog",
        redirectHost: "site.example.com",
        family: "localization",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        templates: [],
      },
    };
    mocks.projectsQueryResult = { data: [] };
    mocks.createProject.mockResolvedValue({ isSuccess: true, tenantGroupId: "new-group", errors: {} });

    mount();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Project name"), "New project");
    await user.click(screen.getByRole("button", { name: "Development, branch dev" }));
    await user.click(screen.getByRole("checkbox", { name: "Use Blocks exclusively" }));
    await user.click(screen.getByRole("checkbox", { name: "Accept the Terms of services" }));
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(mocks.createProject).toHaveBeenCalledOnce());
    expect(await screen.findByText("Project created successfully")).toBeTruthy();
    expect(screen.getByText("Loading environments for New project…")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create project" })).toBeNull();
    expect(screen.queryByLabelText("Project name")).toBeNull();
  });

  it("selects an access option and connects from the single footer action", async () => {
    mocks.requestQueryResult = {
      data: {
        requestId: "req-1",
        siteName: "My Blog",
        redirectHost: "site.example.com",
        family: "localization",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        suggestedTemplateKey: "localization-read",
        templates: [
          { key: "localization-read", displayName: "Localization Read", description: "Read translations.", accessLevel: "read", permissionCount: 3 },
          { key: "localization-full", displayName: "Localization Full", description: "Manage translations.", accessLevel: "full", permissionCount: 7 },
        ],
      },
    };
    mocks.projectsQueryResult = {
      data: [{
        tenantGroupId: "group-1",
        projects: [{ itemId: "project-1", tenantId: "environment-1", environment: "dev", name: "Project" }],
      }],
    };
    mocks.checkReadiness
      .mockResolvedValueOnce({ ready: false, missingPermissions: ["blocks-localization::key::gets"] })
      .mockResolvedValueOnce({ ready: true, missingPermissions: [] });

    mount();
    const user = userEvent.setup();
    expect(screen.queryByText(/Step 2 of 3/)).toBeNull();
    expect(screen.queryByText("Connection request")).toBeNull();
    expect(screen.getByText("My Blog")).toBeTruthy();
    expect(screen.getByText("site.example.com")).toBeTruthy();
    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(screen.getByRole("option", { name: "Project" }));
    expect(screen.queryByText("Connect options")).toBeNull();
    fireEvent.click(screen.getByText("dev"));
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("Connect options")).toBeTruthy();
    expect(screen.getByText("Read translations.")).toBeTruthy();
    expect(screen.getByText("Manage translations.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select Localization Read" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Select Localization Full" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("button", { name: "Connect" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
    expect(mocks.checkReadiness).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Select Localization Full" }));
    expect(screen.getByRole("button", { name: "Select Localization Full" }).getAttribute("aria-pressed")).toBe("true");
    expect(mocks.checkReadiness).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(mocks.checkReadiness).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Select Localization Read" }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(mocks.checkReadiness).toHaveBeenCalledTimes(2), { timeout: 4_000 });
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith("req-1", "localization-full"));
    expect(await screen.findByText("Connection successful")).toBeTruthy();
    expect(screen.getByText("Your site is connected to Blocks OS.")).toBeTruthy();
    expect(screen.getByText("Redirecting you to My Blog…")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to site now" }).getAttribute("href"))
      .toBe("https://site.example.com/callback?code=code-1");
  }, 5_000);

});
