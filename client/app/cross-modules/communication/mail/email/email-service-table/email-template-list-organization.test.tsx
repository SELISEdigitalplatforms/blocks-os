import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({ useScopedPath: () => (p: string) => p }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useCloneTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteEmailTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useGetTemplateLanguages: () => ({ isLoading: false, data: [] }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({ isLoading: false, data: [] }),
}));
vi.mock("./template-filter-toolbar", () => ({
  useTemplatesSortQueryParams: () => ({
    sortQueryParams: { property: "Name", isDescending: false },
    setSortQueryParams: vi.fn(),
  }),
}));

import { EmailTemplateList } from "./email-template-list";
import type { IEmailConfig, IEmailTemplate } from "@blocks-communication/mail/models/email";

const configs = [
  { itemId: "def", name: "Default", isDefault: true, isInbound: false },
  {
    itemId: "acme-ses",
    name: "Acme Marketing (SES)",
    organizationId: "acme",
    isOrganizationDefault: true,
    isInbound: false,
  },
  { itemId: "acme-smtp", name: "Acme SMTP", organizationId: "acme", isInbound: false },
] as unknown as IEmailConfig[];

const templates = [
  {
    itemId: "t1",
    name: "OrderConfirmation",
    language: "en-US",
    mailConfigurationId: "",
    organizationId: "acme",
    templateSubject: "s",
  },
  {
    itemId: "t2",
    name: "ShipmentUpdate",
    language: "lang-x",
    mailConfigurationId: "acme-smtp",
    organizationId: "acme",
    templateSubject: "s",
  },
] as unknown as IEmailTemplate[];

describe("EmailTemplateList per organization (H6, H7, D10)", () => {
  it("adds a Language column with the project's language names and the code as fallback", () => {
    render(
      <EmailTemplateList
        templates={templates}
        isLoading={false}
        emailConfigsData={configs}
        languages={[{ languageCode: "en-US", languageName: "English" }]}
        organizationName="Acme Corp"
        isMultiOrgEnabled
        onRowClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Language" })).toBeTruthy();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("English")).toBeTruthy();
    expect(within(rows[2]).getByText("lang-x")).toBeTruthy();
  });

  it("shows Organization default with the configuration it resolves to, from the loaded list", () => {
    render(
      <EmailTemplateList
        templates={templates}
        isLoading={false}
        emailConfigsData={configs}
        languages={[]}
        organizationName="Acme Corp"
        isMultiOrgEnabled
        onRowClick={vi.fn()}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Organization default")).toBeTruthy();
    expect(within(rows[1]).getByText("via Acme Marketing (SES)")).toBeTruthy();
    expect(within(rows[2]).getByText("Acme SMTP")).toBeTruthy();
  });
});
