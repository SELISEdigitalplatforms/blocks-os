import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailTemplate } from "../../../models/email";
import { NO_SHARE } from "@blocks-communication/mail/constants/share-organizations";

const h = vi.hoisted(() => ({
  organization: { isMultiOrgEnabled: true, isLoading: false, selectedOrganizationId: "default" },
  shareProps: [] as Array<{ templateId?: string }>,
}));

vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailSecretConfigs: () => ({
    isLoading: false,
    data: { configurations: [{ itemId: "def", name: "Default", isDefault: true }] },
  }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({
    isLoading: false,
    data: [{ languageCode: "en-US", languageName: "English" }],
  }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  useEmailOrganization: () => h.organization,
  useOrganizationName: (id: string) => (id === "acme" ? "Acme Corp" : "Default organization"),
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn() }));
vi.mock(
  "@blocks-communication/mail/components/email-service/share-with-organizations/share-with-organizations",
  () => ({
    ShareWithOrganizations: (props: { templateId?: string }) => {
      h.shareProps.push(props);
      return <div>share-block</div>;
    },
  }),
);

import BasicInformation from "./basic-information";

const blank = { itemId: "", name: "", language: "", templateSubject: "" } as IEmailTemplate;
const renderStep = (templateData: IEmailTemplate = blank) =>
  render(
    <BasicInformation
      templateData={templateData}
      shareChoice={NO_SHARE}
      onShareChoiceChange={vi.fn()}
    />,
  );

describe("BasicInformation share block (SPEC33 H7, C13)", () => {
  beforeEach(() => {
    h.shareProps = [];
    h.organization = {
      isMultiOrgEnabled: true,
      isLoading: false,
      selectedOrganizationId: "default",
    };
  });

  it("offers sharing for a Default organization template with multi-org on", () => {
    renderStep();
    expect(screen.getByText("share-block")).toBeTruthy();
    expect(h.shareProps.at(-1)?.templateId).toBeUndefined();
  });

  it("passes the saved template's id once step 1 has saved it (Q4: A)", () => {
    renderStep({ ...blank, itemId: "d-1", name: "Welcome", language: "en-US" });
    expect(h.shareProps.at(-1)?.templateId).toBe("d-1");
  });

  it("offers no sharing on an organization's own template (C1)", () => {
    h.organization = { ...h.organization, selectedOrganizationId: "acme" };
    renderStep();
    expect(screen.queryByText("share-block")).toBeNull();
  });

  it("offers no sharing with multi-org off (C13)", () => {
    h.organization = { ...h.organization, isMultiOrgEnabled: false };
    renderStep();
    expect(screen.queryByText("share-block")).toBeNull();
  });
});
