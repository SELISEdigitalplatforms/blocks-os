import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  clone: vi.fn(),
  del: vi.fn(),
  toast: vi.fn(),
  isClonePending: false,
  isDeletePending: false,
}));

vi.mock("react-router", () => ({
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useCloneTemplate: () => ({ mutateAsync: h.clone, isPending: h.isClonePending }),
  useDeleteEmailTemplate: () => ({ mutateAsync: h.del, isPending: h.isDeletePending }),
}));
// The sort toolbar hook depends on the nuqs query-param adapter which is not
// mounted in unit tests; stub it with a static value.
vi.mock("./template-filter-toolbar", () => ({
  useTemplatesSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

import { EmailTemplateList } from "./email-template-list";
import type { IEmailConfig, IEmailTemplate } from "@blocks-communication/mail/models/email";

const emailConfigsData = [{ itemId: "cfg-1", name: "Primary SMTP" }] as unknown as IEmailConfig[];

const templates = [
  {
    itemId: "t-1",
    name: "Welcome",
    mailConfigurationId: "cfg-1",
    templateSubject: "Welcome aboard",
    lastUpdatedDate: "2024-05-01T10:00:00Z",
    generatedBy: "Tenant",
  },
  {
    itemId: "t-2",
    name: "Reset",
    mailConfigurationId: "cfg-1",
    templateSubject: "Reset your password",
    lastUpdatedDate: "2024-05-02T10:00:00Z",
    generatedBy: "System",
  },
] as unknown as IEmailTemplate[];

const renderList = (overrides: Partial<React.ComponentProps<typeof EmailTemplateList>> = {}) => {
  const onRowClick = overrides.onRowClick ?? vi.fn();
  render(
    <EmailTemplateList
      templates={overrides.templates ?? templates}
      isLoading={overrides.isLoading ?? false}
      emailConfigsData={overrides.emailConfigsData ?? emailConfigsData}
      onRowClick={onRowClick}
    />,
  );
  return { onRowClick };
};

describe("EmailTemplateList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isClonePending = false;
    h.isDeletePending = false;
    h.clone.mockResolvedValue({ isSuccess: true, itemId: "clone-1" });
    h.del.mockResolvedValue({ isSuccess: true });
  });

  it("renders a loading skeleton while loading", () => {
    renderList({ isLoading: true });
    expect(document.body.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("renders each template with its resolved configuration name", () => {
    renderList();
    expect(screen.getByText("Welcome")).toBeTruthy();
    expect(screen.getByText("Reset")).toBeTruthy();
    expect(screen.getByText("Welcome aboard")).toBeTruthy();
    expect(screen.getAllByText("Primary SMTP").length).toBe(2);
  });

  it("shows the empty state when there are no templates", () => {
    renderList({ templates: [] });
    expect(screen.getByText("No templates found.")).toBeTruthy();
  });

  it("invokes onRowClick when a row is clicked", async () => {
    const user = userEvent.setup();
    const { onRowClick } = renderList();
    await user.click(screen.getByText("Welcome"));
    expect(onRowClick).toHaveBeenCalledWith("t-1");
  });

  it("opens the actions menu and views details", async () => {
    const user = userEvent.setup();
    const { onRowClick } = renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByText("View details"));
    expect(onRowClick).toHaveBeenCalledWith("t-1");
  });

  it("hides the delete action for tenant-generated templates and shows it otherwise", async () => {
    const user = userEvent.setup();
    renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    // First row is Tenant-generated: no delete action.
    await user.click(menuButtons[0]);
    await screen.findByText("Clone Template");
    expect(screen.queryByText("Delete")).toBeNull();
    // Close and open the second (System-generated) row menu.
    await user.keyboard("{Escape}");
    await user.click(menuButtons[1]);
    expect(await screen.findByText("Delete")).toBeTruthy();
  });

  it("clones a template and navigates to the new communication on success", async () => {
    const user = userEvent.setup();
    renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByText("Clone Template"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(h.clone).toHaveBeenCalledWith({ itemId: "t-1" }));
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Cloned template successfully" }),
    );
    expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management/communications/clone-1");
  });

  it("surfaces a destructive toast when cloning fails", async () => {
    h.clone.mockResolvedValue({ isSuccess: false, errors: { code: "nope" } });
    const user = userEvent.setup();
    renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByText("Clone Template"));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("deletes a template and reports success", async () => {
    const user = userEvent.setup();
    renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    await user.click(menuButtons[1]);
    await user.click(await screen.findByText("Delete"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Yes" }));

    await waitFor(() => expect(h.del).toHaveBeenCalledWith({ itemId: "t-2" }));
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Deleted template successfully" }),
    );
  });
});
