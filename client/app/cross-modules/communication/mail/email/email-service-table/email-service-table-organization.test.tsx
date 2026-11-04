import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setQueryParams: vi.fn(),
  refetch: vi.fn(),
  templatesArgs: [] as unknown[],
  configsArgs: [] as unknown[],
  templates: {} as Record<string, unknown>,
  organization: { isMultiOrgEnabled: true, isLoading: false, selectedOrganizationId: "acme" },
  queryParams: { pageNumber: 0, pageSize: 10, search: "", language: "", mailConfigurationId: "" },
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/s/${p}`,
}));
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
  useEmailUsageFilterQueryParams: () => ({ setQueryParams: vi.fn() }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplates: (...args: unknown[]) => {
    h.templatesArgs = args;
    return h.templates;
  },
}));
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: (...args: unknown[]) => {
    h.configsArgs = args;
    return { isLoading: false, data: { configurations: [] } };
  },
}));
vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  EMAIL_ORGANIZATION_PARAM: "emailOrg",
  useEmailOrganization: () => h.organization,
  useOrganizationName: (id: string) => (id === "acme" ? "Acme Corp" : "Default organization"),
}));
vi.mock(
  "@blocks-communication/mail/components/email-service/email-organization-picker/email-organization-picker",
  () => ({ EmailOrganizationPicker: () => <div data-testid="org-picker" /> }),
);
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({ isLoading: false, data: [] }),
}));
vi.mock("@blocks-communication/mail/email/email-service-table/email-template-list", () => ({
  EmailTemplateList: () => <div data-testid="template-list" />,
}));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-list", () => ({
  EmailUsageList: () => null,
}));

import { EmailServiceTable } from "./email-service-table";

describe("EmailServiceTable per organization (H6, C12, C13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.organization = { isMultiOrgEnabled: true, isLoading: false, selectedOrganizationId: "acme" };
    h.templates = {
      isLoading: false,
      isError: false,
      refetch: h.refetch,
      data: { templates: [{ itemId: "1" }], totalCount: 14 },
    };
    h.queryParams = {
      pageNumber: 0,
      pageSize: 10,
      search: "",
      language: "",
      mailConfigurationId: "",
    };
  });

  it("shows the picker, the organization's count and the fallback hint with multi-org on", () => {
    render(<EmailServiceTable />);
    expect(screen.getByTestId("org-picker")).toBeTruthy();
    expect(screen.getByText("Acme Corp · 14 templates")).toBeTruthy();
    expect(
      screen.getByText(
        "A mail Acme Corp has no template for uses the Default organization's template.",
      ),
    ).toBeTruthy();
    expect(h.templatesArgs[7]).toBe("acme");
    expect(h.configsArgs[0]).toBe("acme");
  });

  it("hides the picker, the organization and the hint with multi-org off (C13)", () => {
    h.organization = {
      isMultiOrgEnabled: false,
      isLoading: false,
      selectedOrganizationId: "default",
    };
    render(<EmailServiceTable />);
    expect(screen.queryByTestId("org-picker")).toBeNull();
    expect(screen.getByText("14 templates")).toBeTruthy();
    expect(screen.queryByText(/has no template for uses/)).toBeNull();
    expect(h.templatesArgs[7]).toBe("default");
  });

  it("shows no fallback hint for the Default organization itself", () => {
    h.organization = {
      isMultiOrgEnabled: true,
      isLoading: false,
      selectedOrganizationId: "default",
    };
    render(<EmailServiceTable />);
    expect(screen.getByText("Default organization · 14 templates")).toBeTruthy();
    expect(screen.queryByText(/has no template for uses/)).toBeNull();
  });

  it("shows the organization's empty state with Add Template", async () => {
    h.templates = { ...h.templates, data: { templates: [], totalCount: 0 } };
    const user = userEvent.setup();
    render(<EmailServiceTable />);
    expect(screen.getByText("Acme Corp has no templates yet")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Add Template" });
    await user.click(buttons[buttons.length - 1]);
    expect(h.navigate).toHaveBeenCalledWith("/s/email-management/new-communication?emailOrg=acme");
  });

  it("shows an error with retry when the list fails", async () => {
    h.templates = { isLoading: false, isError: true, refetch: h.refetch, data: undefined };
    const user = userEvent.setup();
    render(<EmailServiceTable />);
    expect(screen.getByText("Couldn't load the templates.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("pages with a range and rows per page", () => {
    render(<EmailServiceTable />);
    expect(screen.getByText("1–10 of 14")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });
});
