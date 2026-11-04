import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));
// The clone and delete dialogs have their own tests; here they only report what they were
// opened for and call back as a finished clone or delete would.
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/clone-template/clone-template",
  () => ({
    CloneTemplateDialog: (p: { template: { itemId: string }; onCloned: (id: string) => void }) => (
      <div role="dialog">
        clone {p.template.itemId}
        <button onClick={() => p.onCloned("clone-1")}>finish clone</button>
      </div>
    ),
  }),
);
vi.mock(
  "@blocks-communication/mail/components/email-service/modals/delete-template/delete-template",
  () => ({
    DeleteTemplateDialog: (p: { template: { itemId: string }; onDeleted: () => void }) => (
      <div role="dialog">
        delete {p.template.itemId}
        <button onClick={p.onDeleted}>finish delete</button>
      </div>
    ),
  }),
);
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

  it("opens the clone dialog for the row and goes to the clone when it is made (H10)", async () => {
    const user = userEvent.setup();
    renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    await user.click(menuButtons[0]);
    await user.click(await screen.findByText("Clone Template"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("clone t-1")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "finish clone" }));
    expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management/communications/clone-1");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens the delete dialog for the row and closes it when done (H11)", async () => {
    const user = userEvent.setup();
    renderList();
    const menuButtons = screen.getAllByRole("button", { name: /Open menu/i });
    await user.click(menuButtons[1]);
    await user.click(await screen.findByText("Delete"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("delete t-2")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "finish delete" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
