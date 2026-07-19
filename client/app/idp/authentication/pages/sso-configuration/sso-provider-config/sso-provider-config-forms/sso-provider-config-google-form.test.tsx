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

// Roles/permissions widgets pull in data hooks; stub them out so the form is isolated.
vi.mock("@blocks-idp/authentication/components/sso-initial-roles", () => ({
  SSOInitialRoles: () => <div data-testid="initial-roles" />,
}));

vi.mock("@blocks-idp/authentication/components/sso-initial-permissions", () => ({
  SSOInitialPermissions: () => <div data-testid="initial-permissions" />,
}));

const { SSOProviderConfigGoogleForm } = await import(
  "./sso-provider-config-google-form"
);

const validConfiguration = {
  provider: "google",
  audience: "https://audience.example.com",
  clientId: "client-123",
  clientSecret: "secret-456",
  redirectUrl: "https://redirect.example.com/callback",
  initialRoles: [],
  initialPermissions: [],
  userRoles: [
    { itemId: "1", name: "user", slug: "user", description: "default" },
  ],
  userPermissions: [],
};

const renderForm = (props: {
  save: (data: unknown) => void;
  configuration?: typeof validConfiguration | null;
}) =>
  render(
    <MemoryRouter>
      <SSOProviderConfigGoogleForm
        save={props.save}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        configuration={(props.configuration ?? null) as any}
      />
    </MemoryRouter>,
  );

describe("SSOProviderConfigGoogleForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the OAuth field labels and the client-id help link", () => {
    renderForm({ save: vi.fn() });

    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Client ID")).toBeTruthy();
    expect(screen.getByText("Client Secret")).toBeTruthy();
    expect(screen.getByText("Redirect Url")).toBeTruthy();
    expect(screen.getByText("Audience")).toBeTruthy();
    expect(screen.getByText("How to obtain a Client ID?")).toBeTruthy();
  });

  it("renders the roles and permissions sub-sections", () => {
    renderForm({ save: vi.fn() });
    expect(screen.getByTestId("initial-roles")).toBeTruthy();
    expect(screen.getByTestId("initial-permissions")).toBeTruthy();
  });

  it("submits the configuration values when valid", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderForm({ save, configuration: validConfiguration });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1);
    });
    expect(save.mock.calls[0][0]).toMatchObject({
      provider: "google",
      clientId: "client-123",
      clientSecret: "secret-456",
      audience: "https://audience.example.com",
      redirectUrl: "https://redirect.example.com/callback",
    });
  });

  it("blocks submission and surfaces validation errors when required fields are empty", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    renderForm({ save });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Client id is required")).toBeTruthy();
    });
    expect(save).not.toHaveBeenCalled();
  });
});
