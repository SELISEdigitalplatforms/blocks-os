import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  organization: {
    isMultiOrgEnabled: true,
    isLoading: false,
    selectedOrganizationId: "default",
    setSelectedOrganizationId: vi.fn(),
  },
  comboboxProps: [] as Record<string, unknown>[],
}));

vi.mock("@blocks-communication/mail/hooks/use-email-organization", () => ({
  useEmailOrganization: () => h.organization,
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/components/organization-combobox", () => ({
  OrganizationCombobox: (
    props: Record<string, unknown> & { id: string; onValueChange: (id: string) => void },
  ) => {
    h.comboboxProps.push(props);
    return (
      <button type="button" id={props.id} onClick={() => props.onValueChange("acme")}>
        picker
      </button>
    );
  },
}));

import { EmailOrganizationPicker } from "./email-organization-picker";

describe("EmailOrganizationPicker", () => {
  beforeEach(() => {
    h.organization = {
      ...h.organization,
      isMultiOrgEnabled: true,
      selectedOrganizationId: "default",
      setSelectedOrganizationId: vi.fn(),
    };
    h.comboboxProps = [];
  });

  it("is not shown when multi-org is off (H12)", () => {
    h.organization = { ...h.organization, isMultiOrgEnabled: false };
    const { container } = render(<EmailOrganizationPicker />);
    expect(container.textContent).toBe("");
  });

  it("is a labelled organization combobox with Default organization first and its description (H7)", () => {
    render(<EmailOrganizationPicker />);

    expect(screen.getByLabelText("Organization")).toBeTruthy();
    expect(h.comboboxProps.at(-1)).toMatchObject({
      projectKey: "tenant-1",
      value: "default",
      defaultOptionLabel: "Default organization",
      defaultOptionDescription: "Shared by every organization · holds the project default",
      errorMessage:
        "Couldn't load organizations. The Default organization's configurations are still shown.",
    });
  });

  it("keeps the picked organization for the page", () => {
    render(<EmailOrganizationPicker />);
    fireEvent.click(screen.getByLabelText("Organization"));
    expect(h.organization.setSelectedOrganizationId).toHaveBeenCalledWith("acme");
  });
});
