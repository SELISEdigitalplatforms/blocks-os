import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setQueryParams: vi.fn(),
  setEmailUsageQueryParams: vi.fn(),
  templates: { isLoading: false, data: { templates: [], totalCount: 0 } } as {
    isLoading: boolean;
    data?: { templates: unknown[]; totalCount: number };
  },
  configs: { isLoading: false, data: [] as unknown },
  languages: { isLoading: false, data: [] as unknown },
  queryParams: { pageNumber: 0, pageSize: 10, search: "", language: "", mailConfigurationId: "" },
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({ useScopedPath: () => (p: string) => `/s/${p}` }));
vi.mock("nuqs", async () => {
  const React = await import("react");
  return {
    useQueryState: (_key: string, opts?: { defaultValue?: string }) =>
      React.useState(opts?.defaultValue ?? ""),
  };
});

vi.mock("./template-filter-toolbar", () => ({
  TemplateFilterToolbar: () => <div data-testid="template-filter" />,
  useTemplatesFilterQueryParams: () => ({
    queryParams: h.queryParams,
    setQueryParams: h.setQueryParams,
  }),
  useTemplatesSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
  }),
}));
vi.mock("../email-usage/email-usage-filter-toolbar", () => ({
  useEmailUsageFilterQueryParams: () => ({ setQueryParams: h.setEmailUsageQueryParams }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplates: () => h.templates,
}));
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailConfigs: () => h.configs,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => h.languages,
}));
vi.mock("@blocks-communication/mail/email/email-service-table/email-template-list", () => ({
  EmailTemplateList: ({ onRowClick }: { onRowClick: (id: string) => void }) => (
    <button onClick={() => onRowClick("tpl-7")}>row</button>
  ),
}));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-list", () => ({
  EmailUsageList: ({ isInbound }: { isInbound: boolean }) => (
    <div data-testid="usage-list">{isInbound ? "inbound" : "outbound"}</div>
  ),
}));

import { EmailServiceTable } from "./email-service-table";

describe("EmailServiceTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.templates = { isLoading: false, data: { templates: [{ id: 1 }], totalCount: 0 } };
    h.configs = { isLoading: false, data: [] };
    h.languages = { isLoading: false, data: [] };
    h.queryParams = {
      pageNumber: 0,
      pageSize: 10,
      search: "",
      language: "",
      mailConfigurationId: "",
    };
  });

  it("renders the templates tab with its header and filter toolbar by default", () => {
    render(<EmailServiceTable />);
    expect(screen.getByText("Email Templates")).toBeTruthy();
    expect(screen.getByTestId("template-filter")).toBeTruthy();
    expect(screen.getByText("Add Template")).toBeTruthy();
  });

  it("shows a loading skeleton while templates are loading", () => {
    h.templates = { isLoading: true, data: undefined };
    const { container } = render(<EmailServiceTable />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("navigates to the new-communication route from Add Template", async () => {
    const user = userEvent.setup();
    render(<EmailServiceTable />);
    await user.click(screen.getByText("Add Template"));
    expect(h.navigate).toHaveBeenCalledWith("/s/email-management/new-communication");
  });

  it("navigates to a template's communications route when a row is clicked", async () => {
    const user = userEvent.setup();
    render(<EmailServiceTable />);
    await user.click(screen.getByText("row"));
    expect(h.navigate).toHaveBeenCalledWith("/s/email-management/communications/tpl-7");
  });

  it("delegates row clicks to the onRowClick prop when supplied", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<EmailServiceTable onRowClick={onRowClick} />);
    await user.click(screen.getByText("row"));
    expect(onRowClick).toHaveBeenCalledWith("tpl-7");
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("renders pagination when the total count exceeds the page size", () => {
    h.templates = { isLoading: false, data: { templates: [{ id: 1 }], totalCount: 25 } };
    render(<EmailServiceTable />);
    expect(screen.getByText(/Page 1 of/)).toBeTruthy();
  });

  it("switches to the inbox tab and resets the query params", async () => {
    const user = userEvent.setup();
    render(<EmailServiceTable />);
    await user.click(screen.getByRole("tab", { name: "Incoming Mails" }));
    expect(screen.getByTestId("usage-list").textContent).toBe("inbound");
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
    expect(h.setEmailUsageQueryParams).toHaveBeenCalledWith(null);
  });
});
