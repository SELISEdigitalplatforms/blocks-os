import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  selectedTenantGroup: "group-1" as string | undefined,
  useGetAssets: vi.fn(),
  addAsset: vi.fn(),
  deleteAsset: vi.fn(),
  refetch: vi.fn(),
  refetchAuthorization: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedTenantGroup: h.selectedTenantGroup }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useDebounce: (value: unknown) => value,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));
vi.mock("@/hooks/use-project", () => ({
  useGetAssets: (id: string, page: number, pageSize: number, search: string) =>
    h.useGetAssets(id, page, pageSize, search),
  useAddAssets: () => ({ mutateAsync: h.addAsset }),
  useDeleteAsset: () => ({ mutateAsync: h.deleteAsset, isPending: false }),
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

const assetsResponse = { assets: { resources: [resource] }, totalCount: 1 };

/**
 * Paging and searching happen on the server, so the hook is stubbed with a stand-in that
 * filters and slices a fixture the same way the endpoint does. It lets the tests assert that
 * the page asks for the right window rather than re-filtering the rows itself.
 */
const fakeServer =
  (all: { resourceId: string; name: string; link: string }[]) =>
  (_id: string, page: number, pageSize: number, search: string) => {
    const term = (search ?? "").trim().toLowerCase();
    const matched = term
      ? all.filter(
          (r) => r.name.toLowerCase().includes(term) || r.link.toLowerCase().includes(term),
        )
      : all;

    return {
      data: {
        assets: { resources: matched.slice(page * pageSize, page * pageSize + pageSize) },
        totalCount: matched.length,
      },
      isLoading: false,
      isFetching: false,
      refetch: h.refetch,
    };
  };

describe("RepositoriesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectedTenantGroup = "group-1";
    h.useGetAssets.mockReturnValue({
      data: assetsResponse,
      isLoading: false,
      isFetching: false,
      refetch: h.refetch,
    });
    h.addAsset.mockResolvedValue({ isSuccess: true, errors: null, status: "Added" });
    h.deleteAsset.mockResolvedValue({ isSuccess: true, errors: null });
    h.refetchAuthorization.mockResolvedValue({ data: { isSuccess: false } });
  });

  it("renders a loading skeleton while assets load", () => {
    h.useGetAssets.mockReturnValue({ data: undefined, isLoading: true, refetch: h.refetch });
    render(<RepositoriesPage />);
    expect(document.body.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no repositories and no search", () => {
    h.useGetAssets.mockReturnValue({
      data: { assets: { resources: [] }, totalCount: 0 },
      isLoading: false,
      isFetching: false,
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

  it("asks the server for the search term and renders the rows it returns", async () => {
    const user = userEvent.setup();
    h.useGetAssets.mockImplementation(
      fakeServer([
        resource,
        { resourceId: "r-2", name: "other/repo", link: "https://github.com/other/repo" },
      ]),
    );
    render(<RepositoriesPage />);
    await user.type(screen.getByPlaceholderText("Search repositories..."), "other");

    await waitFor(() =>
      expect(h.useGetAssets).toHaveBeenLastCalledWith("group-1", 0, 12, "other"),
    );
    await waitFor(() => expect(screen.queryByText("acme/service")).toBeNull());
    expect(screen.getByText("other/repo")).toBeTruthy();
  });

  it("shows 'No repositories found.' when a search matches nothing", async () => {
    const user = userEvent.setup();
    h.useGetAssets.mockImplementation(fakeServer([resource]));
    render(<RepositoriesPage />);
    await user.type(screen.getByPlaceholderText("Search repositories..."), "zzz-nope");
    expect(await screen.findByText("No repositories found.")).toBeTruthy();
    // The search box has to survive an empty result, otherwise the term cannot be cleared.
    expect(screen.getByPlaceholderText("Search repositories...")).toBeTruthy();
  });

  // The whole point of server paging: the page holds one window and the count comes from the
  // server, so a group larger than one page is fully reachable.
  it("requests the next page from the server and keeps the count server-driven", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 30 }, (_, i) => ({
      resourceId: `r-${i}`,
      name: `acme/repo-${i}`,
      link: `https://github.com/acme/repo-${i}`,
    }));
    h.useGetAssets.mockImplementation(fakeServer(all));
    render(<RepositoriesPage />);

    expect(h.useGetAssets).toHaveBeenCalledWith("group-1", 0, 12, "");
    expect(screen.getByText("acme/repo-0")).toBeTruthy();
    expect(screen.queryByText("acme/repo-12")).toBeNull();
    const pageLabel = screen.getByText(/Page 1 of 3/);

    const nextPage = pageLabel.parentElement!.querySelectorAll("button")[2];
    await user.click(nextPage);

    await waitFor(() => expect(h.useGetAssets).toHaveBeenLastCalledWith("group-1", 1, 12, ""));
    expect(await screen.findByText("acme/repo-12")).toBeTruthy();
    expect(screen.queryByText("acme/repo-0")).toBeNull();
    expect(screen.getByText(/Page 2 of 3/)).toBeTruthy();
  });

  it("returns to the first page when the search term changes", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 30 }, (_, i) => ({
      resourceId: `r-${i}`,
      name: `acme/repo-${i}`,
      link: `https://github.com/acme/repo-${i}`,
    }));
    h.useGetAssets.mockImplementation(fakeServer(all));
    render(<RepositoriesPage />);

    const nextPage = screen.getByText(/Page 1 of 3/).parentElement!.querySelectorAll("button")[2];
    await user.click(nextPage);
    await waitFor(() => expect(h.useGetAssets).toHaveBeenLastCalledWith("group-1", 1, 12, ""));

    await user.type(screen.getByPlaceholderText("Search repositories..."), "repo-2");

    await waitFor(() =>
      expect(h.useGetAssets).toHaveBeenLastCalledWith("group-1", 0, 12, "repo-2"),
    );
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

  // A renamed repository keeps its id, so the server updates the stored name instead of
  // linking a second repository. The toast has to say so.
  it.each([
    ["Updated", "Repository details updated successfully"],
    ["Unchanged", "Repository is already up to date"],
  ])("reports the %s outcome returned by the server", async (status, description) => {
    h.refetchAuthorization.mockResolvedValue({ data: { isSuccess: true } });
    h.addAsset.mockResolvedValue({ isSuccess: true, errors: null, status });
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    await user.click(await screen.findByRole("button", { name: "pick-repo" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", description }),
      ),
    );
  });

  it("falls back to the added message when the server omits a status", async () => {
    h.refetchAuthorization.mockResolvedValue({ data: { isSuccess: true } });
    h.addAsset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: /Add/ }));
    await user.click(await screen.findByRole("button", { name: "pick-repo" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "success",
          description: "Repository added successfully",
        }),
      ),
    );
  });

  // ─── removing a repository ──────────────────────────────────────────────────

  it("asks for confirmation before removing a repository", async () => {
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: "Remove acme/service" }));

    expect(await screen.findByText("Remove this repository?")).toBeTruthy();
    expect(h.deleteAsset).not.toHaveBeenCalled();
  });

  it("removes the repository once the removal is confirmed", async () => {
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: "Remove acme/service" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(h.deleteAsset).toHaveBeenCalledWith({
        tenantGroupId: "group-1",
        resourceId: "r-1",
      }),
    );
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Repository removed successfully" }),
    );
    expect(h.refetch).toHaveBeenCalled();
  });

  it("keeps the repository when the removal is cancelled", async () => {
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: "Remove acme/service" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Remove this repository?")).toBeNull());
    expect(h.deleteAsset).not.toHaveBeenCalled();
  });

  it("reports a destructive toast when removing a repository fails", async () => {
    h.deleteAsset.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<RepositoriesPage />);
    await user.click(screen.getByRole("button", { name: "Remove acme/service" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "nope" }),
      ),
    );
  });

  // Removing the last row of the last page would otherwise strand the table past the end.
  it("steps back a page when the last row on the final page is removed", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 13 }, (_, i) => ({
      resourceId: `r-${i}`,
      name: `acme/repo-${i}`,
      link: `https://github.com/acme/repo-${i}`,
    }));
    h.useGetAssets.mockImplementation(fakeServer(all));
    render(<RepositoriesPage />);

    const nextPage = screen.getByText(/Page 1 of 2/).parentElement!.querySelectorAll("button")[2];
    await user.click(nextPage);
    await waitFor(() => expect(h.useGetAssets).toHaveBeenLastCalledWith("group-1", 1, 12, ""));

    await user.click(await screen.findByRole("button", { name: "Remove acme/repo-12" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(h.useGetAssets).toHaveBeenLastCalledWith("group-1", 0, 12, ""));
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
