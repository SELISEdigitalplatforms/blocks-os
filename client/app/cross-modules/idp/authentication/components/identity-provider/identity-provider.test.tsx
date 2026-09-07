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
vi.mock("./identity-provider-gallery", () => ({
  GallerySkeleton: () => <div data-testid="idp-loading" />,
  IdentityProviderGallery: (props: {
    blocksOidcEntries: { itemId?: string }[];
    byosEntries: { itemId?: string }[];
    onSelectGoogle: () => void;
    onSelectMicrosoft: () => void;
    onSelectBlocksOidc: () => void;
    onSelectByos: () => void;
  }) => (
    <div
      data-testid="idp-gallery"
      data-blocks-oidc-count={props.blocksOidcEntries.length}
      data-byos-count={props.byosEntries.length}
    >
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

const blocksOidcProvider = {
  itemId: "idp-blocks",
  providerType: "blocks-oidc",
  provider: "sibling-project",
  displayName: "Sibling Project",
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

  it("shows the gallery with no separate table when nothing is configured", () => {
    renderPage();
    expect(screen.queryByText("Configured providers")).toBeNull();
    const gallery = screen.getByTestId("idp-gallery");
    expect(gallery.getAttribute("data-blocks-oidc-count")).toBe("0");
    expect(gallery.getAttribute("data-byos-count")).toBe("0");
  });

  it("keeps the gallery as the only view once a provider exists", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: { data: [googleProvider] },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    renderPage();
    expect(screen.queryByText("Configured providers")).toBeNull();
    expect(screen.getByTestId("idp-gallery")).toBeTruthy();
  });

  it("routes each enterprise entry to its own type's gallery card", () => {
    h.useGetIdentityProviders.mockReturnValue({
      data: {
        data: [googleProvider, byosProvider, blocksOidcProvider, { ...byosProvider, itemId: "b2" }],
      },
      isLoading: false,
      isError: false,
      refetch: h.refetch,
    });
    renderPage();
    const gallery = screen.getByTestId("idp-gallery");
    expect(gallery.getAttribute("data-byos-count")).toBe("2");
    expect(gallery.getAttribute("data-blocks-oidc-count")).toBe("1");
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

  it("C1/C2: shows an inline error with Retry and hides the gallery content", () => {
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
