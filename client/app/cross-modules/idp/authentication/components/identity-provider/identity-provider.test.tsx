import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useGetIdentityProviders: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { itemId: "project-1", tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-identity-provider", () => ({
  useGetIdentityProviders: h.useGetIdentityProviders,
}));
vi.mock("./identity-provider-list", () => ({
  IdentityProviderList: ({ providers }: { providers: { itemId?: string }[] }) => (
    <div data-testid="idp-table" data-count={providers.length} />
  ),
  LoadingSkeleton: () => <div data-testid="idp-loading" />,
}));
vi.mock("./identity-provider-gallery", () => ({
  IdentityProviderGallery: (props: {
    showHowItWorks: boolean;
    onSelectGoogle: () => void;
    onSelectMicrosoft: () => void;
    onSelectBlocksOidc: () => void;
    onSelectByos: () => void;
  }) => (
    <div data-testid="idp-gallery" data-how-it-works={String(props.showHowItWorks)}>
      <button onClick={props.onSelectGoogle}>pick-google</button>
      <button onClick={props.onSelectMicrosoft}>pick-microsoft</button>
      <button onClick={props.onSelectBlocksOidc}>pick-blocks-oidc</button>
      <button onClick={props.onSelectByos}>pick-byos</button>
    </div>
  ),
}));
vi.mock("./identity-provider-form-dialog", () => ({
  IdentityProviderFormDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editId?: string;
    presetProviderType?: string;
    presetProvider?: string;
    isGoogleConfigured?: boolean;
    isMicrosoftConfigured?: boolean;
  }) => (
    <div
      data-testid="idp-dialog"
      data-open={String(props.open)}
      data-edit-id={props.editId ?? ""}
      data-preset-type={props.presetProviderType ?? ""}
      data-preset-provider={props.presetProvider ?? ""}
      data-google-configured={String(props.isGoogleConfigured)}
      data-microsoft-configured={String(props.isMicrosoftConfigured)}
    >
      <button onClick={() => props.onOpenChange(false)}>close-dialog</button>
    </div>
  ),
}));

import { IdentityProviders } from "./identity-provider";
import type { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";

const googleProvider = {
  itemId: "idp-google",
  providerType: "social",
  provider: "google",
  displayName: "Google",
  isActive: true,
} as unknown as IdentityProvider;

const byosProvider = {
  itemId: "idp-byos",
  providerType: "byos",
  provider: "acme",
  displayName: "Acme",
  isActive: true,
} as unknown as IdentityProvider;

const renderPage = (addOpen = false) =>
  render(<IdentityProviders addOpen={addOpen} onAddOpenChange={vi.fn()} />);

describe("IdentityProviders (page)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
  });

  it("H1: shows the gallery with how-it-works and no table when nothing is configured", () => {
    renderPage();
    expect(screen.queryByText("Configured providers")).toBeNull();
    expect(screen.queryByTestId("idp-table")).toBeNull();
    expect(screen.getByTestId("idp-gallery").getAttribute("data-how-it-works")).toBe("true");
  });

  it("H2: shows the configured providers table above the gallery once a provider exists", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [googleProvider] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    renderPage();
    expect(screen.getByText("Configured providers")).toBeTruthy();
    expect(screen.getByText("1 provider active")).toBeTruthy();
    expect(screen.getByTestId("idp-table").getAttribute("data-count")).toBe("1");
    expect(screen.getByTestId("idp-gallery").getAttribute("data-how-it-works")).toBe("false");
  });

  it("pluralizes the summary for multiple providers", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [googleProvider, byosProvider] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    renderPage();
    expect(screen.getByText("2 providers active")).toBeTruthy();
  });

  it("C4: shows a loading skeleton and not the empty-state framing while loading", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: h.refetch,
    });
    renderPage();
    expect(screen.getByTestId("idp-loading")).toBeTruthy();
    expect(screen.queryByTestId("idp-gallery")).toBeNull();
  });

  it("C1/C2: shows an inline error with Retry and hides gallery/table content", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: h.refetch,
    });
    renderPage();
    expect(screen.getByText("Couldn't load identity providers")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByTestId("idp-gallery")).toBeNull();
    expect(screen.queryByTestId("idp-table")).toBeNull();
  });

  it("C3: clicking Retry re-fetches the list", async () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: h.refetch,
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("H4: picking an unconfigured social provider opens the dialog preset to add mode", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "pick-google" }));
    const dialog = screen.getByTestId("idp-dialog");
    expect(dialog.getAttribute("data-open")).toBe("true");
    expect(dialog.getAttribute("data-edit-id")).toBe("");
    expect(dialog.getAttribute("data-preset-type")).toBe("social");
    expect(dialog.getAttribute("data-preset-provider")).toBe("google");
  });

  it("H3: picking an already-configured social provider opens the dialog in edit mode", async () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [googleProvider] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "pick-google" }));
    const dialog = screen.getByTestId("idp-dialog");
    expect(dialog.getAttribute("data-open")).toBe("true");
    expect(dialog.getAttribute("data-edit-id")).toBe("idp-google");
    expect(dialog.getAttribute("data-preset-type")).toBe("");
  });

  it("H5: picking Blocks OIDC or BYOS always opens a blank add dialog preset to that type", async () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [byosProvider] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "pick-byos" }));
    const dialog = screen.getByTestId("idp-dialog");
    expect(dialog.getAttribute("data-edit-id")).toBe("");
    expect(dialog.getAttribute("data-preset-type")).toBe("byos");
  });

  it("H6: the page-level Add button (addOpen) opens the dialog with no preset and no editId", () => {
    renderPage(true);
    const dialog = screen.getByTestId("idp-dialog");
    expect(dialog.getAttribute("data-open")).toBe("true");
    expect(dialog.getAttribute("data-edit-id")).toBe("");
    expect(dialog.getAttribute("data-preset-type")).toBe("");
  });

  it("passes live configured status down to the dialog for the picker to filter on", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [googleProvider] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    renderPage();
    const dialog = screen.getByTestId("idp-dialog");
    expect(dialog.getAttribute("data-google-configured")).toBe("true");
    expect(dialog.getAttribute("data-microsoft-configured")).toBe("false");
  });

  it("closing a gallery-opened dialog clears the pick", async () => {
    const onAddOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<IdentityProviders addOpen={false} onAddOpenChange={onAddOpenChange} />);
    await user.click(screen.getByRole("button", { name: "pick-google" }));
    expect(screen.getByTestId("idp-dialog").getAttribute("data-open")).toBe("true");
    await user.click(screen.getByRole("button", { name: "close-dialog" }));
    expect(screen.getByTestId("idp-dialog").getAttribute("data-open")).toBe("false");
    expect(onAddOpenChange).toHaveBeenCalledWith(false);
  });
});
