import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  selectedTenantGroup: "group-1" as string | undefined,
  useGetAssets: vi.fn(),
  addAsset: vi.fn(),
  refetch: vi.fn(),
  refetchAuthorization: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedTenantGroup: h.selectedTenantGroup }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useDebounce: (value: unknown) => value,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-project", () => ({
  useGetAssets: (id: string) => h.useGetAssets(id),
  useAddAssets: () => ({ mutateAsync: h.addAsset }),
}));
vi.mock("@/cross-modules/devops/hooks/github-info", () => ({
  useValidateAuthorization: () => ({ data: undefined, refetch: h.refetchAuthorization }),
}));
// Heavy child modals are exercised in their own suites; here we only need to
// observe that this page opens them and forwards their callbacks.
vi.mock("@/components/repository-selection-modal/repository-selection-modal", () => ({
  RepositorySelectionModal: ({
    open,
    onSelectRepository,
  }: {
    open: boolean;
    onSelectRepository: (repo: unknown) => void;
  }) =>
    open ? (
      <div data-testid="select-repo-modal">
        <button
          type="button"
          onClick={() =>
            onSelectRepository({ id: 99, full_name: "acme/app", html_url: "https://gh/acme/app" })
          }
        >
          pick-repo
        </button>
      </div>
    ) : null,
}));
vi.mock("@/cross-modules/devops/components/deployment-steps/render-repos/render-provider", () => ({
  default: ({ onClose }: { onClose: (verify?: boolean) => void }) => (
    <button type="button" onClick={() => onClose(true)}>
      provider-connect
    </button>
  ),
}));

import { RepositoriesPage } from "./repositories";

const resource = {
  resourceId: "r-1",
  name: "acme/service",
  link: "https://github.com/acme/service",
};

const assetsResponse = { assets: { resources: [resource] } };

describe("RepositoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedTenantGroup = "group-1";
    h.useGetAssets.mockReturnValue({
      data: assetsResponse,
      isLoading: false,
      refetch: h.refetch,
    });
    h.addAsset.mockResolvedValue(undefined);
    h.refetchAuthorization.mockResolvedValue({ data: { isSuccess: false } });
  });

  it("renders a loading skeleton while assets load", () => {
    h.useGetAssets.mockReturnValue({ data: undefined, isLoading: true, refetch: h.refetch });
    render(<RepositoriesPage />);
    expect(document.body.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no repositories and no search", () => {
    h.useGetAssets.mockReturnValue({
      data: { assets: { resources: [] } },
      isLoading: false,
      refetch: h.refetch,
    });
    render(<RepositoriesPage />);
    expect(screen.getByText("No repositories yet")).toBeTruthy();
  });

  it("renders the repository rows in a table", () => {
    render(<RepositoriesPage />);
    expect(screen.getByText("acme/service")).toBeTruthy();
    expect(screen.getByText("https://github.com/acme/service")).toBeTruthy();
    expect(screen.getByText("Github")).toBeTruthy();
  });

  it("filters repositories by the search text", async () => {
    const user = userEvent.setup();
    h.useGetAssets.mockReturnValue({
      data: {
        assets: {
          resources: [
            resource,
            { resourceId: "r-2", name: "other/repo", link: "https://github.com/other/repo" },
          ],
        },
      },
      isLoading: false,
      refetch: h.refetch,
    });
    render(<RepositoriesPage />);
    await user.type(screen.getByPlaceholderText("Search repositories..."), "other");
    await waitFor(() => expect(screen.queryByText("acme/service")).toBeNull());
    expect(screen.getByText("other/repo")).toBeTruthy();
  });

  it("shows 'No repositories found.' when a search matches nothing", async () => {
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.type(screen.getByPlaceholderText("Search repositories..."), "zzz-nope");
    expect(await screen.findByText("No repositories found.")).toBeTruthy();
  });

  it("opens the provider connect dialog when the user is not authorized", async () => {
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    expect(await screen.findByText("Connect repository")).toBeTruthy();
  });

  it("opens the repository selection modal directly when already authorized", async () => {
    h.refetchAuthorization.mockResolvedValue({ data: { isSuccess: true } });
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    expect(await screen.findByTestId("select-repo-modal")).toBeTruthy();
  });

  it("moves from the provider dialog to repository selection then adds a repo", async () => {
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    // Provider dialog opens because auth failed.
    await user.click(await screen.findByRole("button", { name: "provider-connect" }));
    // Which advances to repository selection.
    await user.click(await screen.findByRole("button", { name: "pick-repo" }));

    await waitFor(() =>
      expect(h.addAsset).toHaveBeenCalledWith({
        tenantGroupId: "group-1",
        resource: {
          resourceId: "99",
          name: "acme/app",
          link: "https://gh/acme/app",
        },
      }),
    );
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Repository added successfully" }),
    );
    expect(h.refetch).toHaveBeenCalled();
  });

  it("reports a destructive toast when adding a repository fails", async () => {
    h.refetchAuthorization.mockResolvedValue({ data: { isSuccess: true } });
    h.addAsset.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    await user.click(await screen.findByRole("button", { name: "pick-repo" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "boom" }),
      ),
    );
  });
});
