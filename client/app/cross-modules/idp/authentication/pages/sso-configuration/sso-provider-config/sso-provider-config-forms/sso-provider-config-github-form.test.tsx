import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock("@blocks-idp/authentication/components/sso-initial-roles", () => ({
  SSOInitialRoles: () => <div data-testid="initial-roles" />,
}));

vi.mock("@blocks-idp/authentication/components/sso-initial-permissions", () => ({
  SSOInitialPermissions: () => <div data-testid="initial-permissions" />,
}));

const { SSOProviderConfigGithubForm } = await import("./sso-provider-config-github-form");

const validConfiguration = {
  provider: "github",
  audience: "https://audience.example.com",
  clientId: "gh-client",
  clientSecret: "gh-secret",
  redirectUrl: "https://redirect.example.com/callback",
  initialRoles: [],
  initialPermissions: [],
  userRoles: [{ itemId: "1", name: "user", slug: "user", description: "default" }],
  userPermissions: [],
};

const renderForm = (
  save: (data: unknown) => void,
  configuration: typeof validConfiguration | null = null,
) =>
  render(
    <MemoryRouter>
      <SSOProviderConfigGithubForm
        save={save}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        configuration={configuration as any}
      />
    </MemoryRouter>,
  );

describe("SSOProviderConfigGithubForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the common OAuth field labels without a help link", () => {
    renderForm(vi.fn());

    expect(screen.getByText("Client ID")).toBeTruthy();
    expect(screen.getByText("Client Secret")).toBeTruthy();
    expect(screen.getByText("Redirect Url")).toBeTruthy();
    expect(screen.getByText("Audience")).toBeTruthy();
    // The GitHub form is built from the plain factory with no help link.
    expect(screen.queryByText("How to obtain a Client ID?")).toBeNull();
  });

  it("submits valid configuration values", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderForm(save, validConfiguration);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(save.mock.calls[0][0]).toMatchObject({
      provider: "github",
      clientId: "gh-client",
    });
  });

  it("rejects an invalid (non-URL) audience", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderForm(save, { ...validConfiguration, audience: "not-a-url" });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Audience URL must be a valid URL.")).toBeTruthy();
    });
    expect(save).not.toHaveBeenCalled();
  });
});
