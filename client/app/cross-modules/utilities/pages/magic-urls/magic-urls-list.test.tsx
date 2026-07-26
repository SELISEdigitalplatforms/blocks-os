import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IMagicUrlConfig } from "@blocks-utilities/models/magic-url-config.model";

const h = vi.hoisted(() => ({
  deleteConfig: vi.fn(),
  isDeleting: false,
  saveConfig: vi.fn(),
  isSaving: false,
  tenantId: "tenant-1",
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@blocks-utilities/hooks/use-magic-url-config", () => ({
  useDeleteMagicUrlConfig: () => ({ mutateAsync: h.deleteConfig, isPending: h.isDeleting }),
  useSaveMagicUrlConfig: () => ({ mutateAsync: h.saveConfig, isPending: h.isSaving }),
}));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));
vi.mock("@blocks-utilities/utils/url.util", () => ({
  getDefaultShortUrlBase: () => "https://short.seliseblocks.com/",
  isValidUrl: (v: string) => /^https?:\/\//.test(v),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));
vi.mock("uuid", () => ({ v4: () => "generated-uuid" }));

import { MagicUrlsList } from "./magic-urls-list";

const openRowMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
) => {
  const trigger = container.querySelector('[aria-haspopup="menu"]') as HTMLElement;
  await user.click(trigger);
};

const config = (over: Partial<IMagicUrlConfig> = {}): IMagicUrlConfig =>
  ({
    itemId: "cfg-1",
    contextName: "Marketing",
    shortUrlBase: "https://go.acme.io/",
    lastUpdatedDate: "2024-01-15T10:00:00Z",
    createdDate: "2024-01-01T10:00:00Z",
    ...over,
  }) as IMagicUrlConfig;

describe("MagicUrlsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isDeleting = false;
    h.deleteConfig.mockResolvedValue({ isSuccess: true });
  });

  it("renders a loading skeleton while loading", () => {
    const { container } = render(<MagicUrlsList configurations={[]} isLoading />);
    expect(container.querySelectorAll(".rounded-xl").length).toBe(5);
  });

  it("renders configuration rows with header labels", () => {
    render(<MagicUrlsList configurations={[config()]} isLoading={false} />);
    expect(screen.getByText("Context Name")).toBeTruthy();
    expect(screen.getByText("Short URL Base")).toBeTruthy();
    expect(screen.getByText("Marketing")).toBeTruthy();
    expect(screen.getByText("https://go.acme.io/")).toBeTruthy();
  });

  it("falls back to a dash when context name and short url are empty", () => {
    render(
      <MagicUrlsList
        configurations={[config({ contextName: "", shortUrlBase: "", lastUpdatedDate: "", createdDate: "" })]}
        isLoading={false}
      />,
    );
    // context name dash, short url dash, and date dash all render
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("opens the edit modal from the row actions", async () => {
    const user = userEvent.setup();
    const { container } = render(<MagicUrlsList configurations={[config()]} isLoading={false} />);

    await openRowMenu(user, container);
    await user.click(await screen.findByText("Edit"));

    expect(await screen.findByText("Edit Magic URL Configuration")).toBeTruthy();
  });

  it("deletes a configuration after confirmation", async () => {
    const user = userEvent.setup();
    const { container } = render(<MagicUrlsList configurations={[config()]} isLoading={false} />);

    await openRowMenu(user, container);
    await user.click(await screen.findByText("Delete"));

    expect(await screen.findByText("Delete Magic URL Configuration")).toBeTruthy();
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(h.deleteConfig).toHaveBeenCalledWith("cfg-1"));
    expect(h.showSuccessToast).toHaveBeenCalledWith({
      description: "Configuration deleted successfully",
    });
  });

  it("shows an error toast when the delete fails", async () => {
    const user = userEvent.setup();
    h.deleteConfig.mockRejectedValue(new Error("boom"));
    const { container } = render(<MagicUrlsList configurations={[config()]} isLoading={false} />);

    await openRowMenu(user, container);
    await user.click(await screen.findByText("Delete"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "Failed to delete configuration" }),
    );
  });
});
