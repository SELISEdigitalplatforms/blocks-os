import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui-kits/form/form";
import type { OrganizationConfigFormValues } from "@blocks-idp/settings/utils/organization-config-form";

vi.mock("@blocks-idp/iam/components/organization-combobox", () => ({
  OrganizationCombobox: ({ value, id }: { value: string; id?: string }) => (
    <button type="button" role="combobox" id={id}>
      {value || "Select organization"}
    </button>
  ),
}));

const { SignupAutoJoinCard } = await import("./signup-auto-join-card");

type Props = {
  isMultiOrgEnabled: boolean;
  isEnabled: boolean;
  organizationId: string;
  onEnabledChange?: (checked: boolean) => void;
};

const Harness = ({
  isMultiOrgEnabled,
  isEnabled,
  organizationId,
  onEnabledChange = vi.fn(),
}: Props) => {
  const form = useForm<OrganizationConfigFormValues>({
    defaultValues: {
      allowOrgCreationFromCloud: false,
      allowOrgCreationFromConstruct: false,
      allowOrgCreationFromSignup: false,
      allowOrgCreationFromPortal: false,
      isMultiOrgEnabled,
      isSignupAutoJoinEnabled: isEnabled,
      signupAutoJoinOrganizationId: organizationId,
    },
  });
  return (
    <Form {...form}>
      <SignupAutoJoinCard
        control={form.control}
        projectKey="tenant-1"
        isMultiOrgEnabled={isMultiOrgEnabled}
        isEnabled={isEnabled}
        organizationId={organizationId}
        onEnabledChange={onEnabledChange}
        onOrganizationChange={vi.fn()}
      />
    </Form>
  );
};

const toggle = () => screen.getByRole("switch", { name: "Add new sign-ups to an organization" });

describe("SignupAutoJoinCard", () => {
  it("S1: disabled with the picker hidden while multi-org is off", () => {
    render(<Harness isMultiOrgEnabled={false} isEnabled organizationId="org-sales" />);
    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("S2: picker hidden while the toggle is off and the switch is operable", async () => {
    const onEnabledChange = vi.fn();
    render(
      <Harness
        isMultiOrgEnabled
        isEnabled={false}
        organizationId=""
        onEnabledChange={onEnabledChange}
      />,
    );
    expect(screen.queryByRole("combobox")).toBeNull();
    toggle().focus();
    await userEvent.setup().keyboard(" ");
    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it("S3: empty picker labelled for keyboard users", () => {
    render(<Harness isMultiOrgEnabled isEnabled organizationId="" />);
    expect(screen.getByLabelText("Organization for new sign-ups").textContent).toBe(
      "Select organization",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("S4: Default shows the tenant-wide warning", () => {
    render(<Harness isMultiOrgEnabled isEnabled organizationId="default" />);
    expect(screen.getByText("New users get tenant-wide access")).toBeTruthy();
  });

  it("S5/S6: a real or unlisted organization shows no warning and keeps the helper text", () => {
    render(<Harness isMultiOrgEnabled isEnabled organizationId="org-gone" />);
    expect(screen.queryByText("New users get tenant-wide access")).toBeNull();
    expect(screen.getByRole("combobox").textContent).toBe("org-gone");
    expect(
      screen.getByText("Sign-ups fail if this organization is deleted or disabled."),
    ).toBeTruthy();
  });
});
