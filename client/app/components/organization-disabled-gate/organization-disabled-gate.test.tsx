import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { delay, http as mswHttp, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { MemoryRouter, Link, Outlet, Route, Routes } from "react-router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useImpersonateStore } from "@seliseblocks/genesis-os/store";
import { tenantScopedQueryKeyHashFn } from "@/lib/query/tenant-query-scope";

const signOut = vi.fn();
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useSignOut: () => signOut,
}));

const { OrganizationDisabledGate } = await import("./organization-disabled-gate");

const MESSAGE = "Your organization is disabled. Please contact your administrator or support.";

let authMeRequests = 0;
let authMeReply: () => Promise<Response> | Response = () => HttpResponse.json({});

const server = setupServer(
  mswHttp.get("*/auth/me", () => {
    authMeRequests += 1;
    return authMeReply();
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Same client options as the app (providers/query-provider.tsx): retry 1 and the tenant-scoped hash.
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        queryKeyHashFn: tenantScopedQueryKeyHashFn,
      },
    },
  });

// Re-renders on a project switch, as the console layout does, so the gate re-reads its query.
const AppShell = ({ children }: { children: ReactNode }) => {
  const tenantId = useImpersonateStore((s) => s.impersonatedTenantId);
  return (
    <div data-tenant={tenantId ?? ""}>
      <OrganizationDisabledGate>{children}</OrganizationDisabledGate>
    </div>
  );
};

const renderApp = (initialPath = "/app/console", client = createQueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route
            path="/app"
            element={
              <AppShell>
                <Outlet />
              </AppShell>
            }
          >
            <Route
              path="console"
              element={
                <>
                  <p>Console content</p>
                  <Link to="/app/profile">to profile</Link>
                </>
              }
            />
            <Route
              path="profile"
              element={
                <>
                  <p>Profile content</p>
                  <Link to="/app/console">to console</Link>
                </>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("OrganizationDisabledGate", () => {
  beforeEach(() => {
    authMeRequests = 0;
    authMeReply = () => HttpResponse.json({});
    signOut.mockClear();
    useImpersonateStore.setState({
      isImpersonated: false,
      impersonatedTenantId: null,
      originalTenantId: "console-tenant",
    } as never);
  });

  it("shows the disabled message instead of the app content (H7)", async () => {
    authMeReply = () => HttpResponse.json({ org_id: "no-org", org_status: "disabled" });
    renderApp();

    expect(await screen.findByText("Organization disabled")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(MESSAGE);
    expect(screen.queryByText("Console content")).toBeNull();
  });

  it("puts focus on Sign out and shows the full text (H10)", async () => {
    authMeReply = () => HttpResponse.json({ org_id: "no-org", org_status: "disabled" });
    renderApp();

    const button = await screen.findByRole("button", { name: "Sign out" });
    await waitFor(() => expect(document.activeElement).toBe(button));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(MESSAGE);
    expect(alert.className).not.toMatch(/truncate|line-clamp/);
  });

  it("calls the genesis sign-out flow from the Sign out button (H8)", async () => {
    authMeReply = () => HttpResponse.json({ org_id: "no-org", org_status: "disabled" });
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("renders the app content when auth/me has no org_status (H9)", async () => {
    authMeReply = () => HttpResponse.json({ sub: "user-1", org_id: "org-1" });
    renderApp();

    await waitFor(() => expect(authMeRequests).toBe(1));
    expect(screen.getByText("Console content")).toBeTruthy();
    expect(screen.queryByText("Organization disabled")).toBeNull();
  });

  it("keeps today's behaviour for a user with no memberships (C6)", async () => {
    authMeReply = () => HttpResponse.json({ org_id: "no-org" });
    renderApp();

    await waitFor(() => expect(authMeRequests).toBe(1));
    expect(screen.getByText("Console content")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["enabled", "Disabled", "", "unknown"])(
    "does not show the message for org_status %j (C5)",
    async (status) => {
      authMeReply = () => HttpResponse.json({ org_id: "no-org", org_status: status });
      renderApp();

      await waitFor(() => expect(authMeRequests).toBe(1));
      expect(screen.getByText("Console content")).toBeTruthy();
      expect(screen.queryByText("Organization disabled")).toBeNull();
    },
  );

  it("renders the app content when auth/me fails, with a single request (C4)", async () => {
    authMeReply = () => HttpResponse.json({ error: "boom" }, { status: 500 });
    const client = createQueryClient();
    renderApp("/app/console", client);

    await waitFor(() => expect(authMeRequests).toBe(1));
    // The app default retries once after a backoff; this query must opt out of it.
    const query = client.getQueryCache().find({ queryKey: ["auth-me"] });
    expect(query?.options.retry).toBe(false);
    await waitFor(() => expect(query?.state.status).toBe("error"));
    expect(authMeRequests).toBe(1);
    expect(screen.getByText("Console content")).toBeTruthy();
    expect(screen.queryByText("Organization disabled")).toBeNull();
  });

  it("does not block the first render while auth/me loads (C7)", async () => {
    authMeReply = async () => {
      await delay("infinite");
      return HttpResponse.json({});
    };
    renderApp();

    expect(screen.getByText("Console content")).toBeTruthy();
    await waitFor(() => expect(authMeRequests).toBe(1));
    expect(screen.getByText("Console content")).toBeTruthy();
  });

  it("requests auth/me once per app load across routes and project switches (H6, C8)", async () => {
    authMeReply = () => HttpResponse.json({ org_id: "org-1" });
    const user = userEvent.setup();
    renderApp();

    await waitFor(() => expect(authMeRequests).toBe(1));
    await user.click(screen.getByRole("link", { name: "to profile" }));
    expect(await screen.findByText("Profile content")).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "to console" }));
    expect(await screen.findByText("Console content")).toBeTruthy();

    // Opening a project swaps the effective tenant the cache is partitioned by.
    act(() => {
      useImpersonateStore.setState({
        isImpersonated: true,
        impersonatedTenantId: "project-tenant",
      } as never);
    });
    await user.click(screen.getByRole("link", { name: "to profile" }));
    expect(await screen.findByText("Profile content")).toBeTruthy();

    await act(() => delay(50));
    expect(authMeRequests).toBe(1);
  });

  it("does not request auth/me on a public route (C11)", async () => {
    renderApp("/login");

    expect(screen.getByText("Login page")).toBeTruthy();
    await act(() => delay(50));
    expect(authMeRequests).toBe(0);
  });
});
