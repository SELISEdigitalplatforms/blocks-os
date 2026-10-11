import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { captureDeepLink } from "@/lib/deep-link";
import { DeepLinkRedirect } from "./deep-link-redirect";

const renderDashboard = (isRoute: (pathname: string) => boolean) => {
  const router = createMemoryRouter(
    [
      {
        path: "/app/:itemId/dashboard",
        element: (
          <>
            <DeepLinkRedirect isRoute={isRoute} />
            <p>dashboard</p>
          </>
        ),
      },
      { path: "/app/:itemId/secret-management/oidc", element: <p>oidc</p> },
    ],
    { initialEntries: ["/app/env-1/dashboard"] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe("DeepLinkRedirect", () => {
  beforeEach(() => sessionStorage.clear());

  it("sends the user to the pending path inside the environment", async () => {
    captureDeepLink({ pathname: "/login", search: "?path=secret-management/oidc" });

    const router = renderDashboard(() => true);

    expect(await screen.findByText("oidc")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/app/env-1/secret-management/oidc");
  });

  it("stays on the dashboard when the path is not a route, and forgets it", async () => {
    captureDeepLink({ pathname: "/login", search: "?path=nope" });

    const router = renderDashboard(() => false);

    expect(await screen.findByText("dashboard")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/app/env-1/dashboard");
    expect(sessionStorage.length).toBe(0);
  });

  it("does nothing without a pending path", async () => {
    const router = renderDashboard(() => true);

    expect(await screen.findByText("dashboard")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/app/env-1/dashboard");
  });
});
