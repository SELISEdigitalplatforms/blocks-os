import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ pathname: "/app/auth/config", setConfigureOpen: vi.fn(), open: false }));

vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: h.pathname }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  Outlet: () => <div data-testid="outlet" />,
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({ useScopedPath: () => (p: string) => `/scoped/${p}` }));
vi.mock("@blocks-communication/mail/email/email-configure/email-configure", () => ({
  EmailConfiguration: () => <div data-testid="email-config" />,
}));
vi.mock("@blocks-idp/iam/modules/role-management", () => ({
  AddRole: () => <div data-testid="add-role" />,
}));
vi.mock("@blocks-idp/iam/modules/organization-management", () => ({
  AddOrganization: () => <div data-testid="add-organization" />,
  OrganizationConfig: () => <div data-testid="organization-config" />,
}));
vi.mock("@blocks-idp/iam/modules/user-management", () => ({
  InviteUser: () => <div data-testid="invite-user" />,
}));
vi.mock("@/components/action-buttons/primary-button", () => ({
  PrimaryButton: ({ label }: { label: string }) => <button>{label}</button>,
}));
vi.mock("nuqs", () => ({
  parseAsBoolean: { withDefault: () => ({}) },
  useQueryState: () => [h.open, h.setConfigureOpen],
}));

import { AuthenticationConfigLayout } from "./authentication-config";

describe("AuthenticationConfigLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pathname = "/app/auth/config";
    h.open = false;
  });

  it("renders the outlet without a header on the config path", () => {
    render(<AuthenticationConfigLayout />);
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("shows the Add Role action on the roles path", () => {
    h.pathname = "/app/auth/roles";
    render(<AuthenticationConfigLayout />);
    expect(screen.getByTestId("add-role")).toBeTruthy();
  });

  it("shows the Add Permission action on the permissions path", () => {
    h.pathname = "/app/auth/permissions";
    render(<AuthenticationConfigLayout />);
    expect(screen.getByRole("button", { name: "Add Permission" })).toBeTruthy();
  });

  it("shows the Invite User action on the users path", () => {
    h.pathname = "/app/auth/users";
    render(<AuthenticationConfigLayout />);
    expect(screen.getByTestId("invite-user")).toBeTruthy();
  });

  it("shows the organization config and add actions on the organizations path", () => {
    h.pathname = "/app/auth/organizations";
    render(<AuthenticationConfigLayout />);
    expect(screen.getByTestId("organization-config")).toBeTruthy();
    expect(screen.getByTestId("add-organization")).toBeTruthy();
  });

  it("keeps the organization actions off the roles path", () => {
    h.pathname = "/app/auth/roles";
    render(<AuthenticationConfigLayout />);
    expect(screen.queryByTestId("add-organization")).toBeNull();
    expect(screen.queryByTestId("organization-config")).toBeNull();
  });

  it("renders the section header for a non-config nav path", () => {
    h.pathname = "/app/auth/oidc-template";
    render(<AuthenticationConfigLayout />);
    // The header block renders for a known nav item that is not the config path.
    expect(screen.getByRole("heading")).toBeTruthy();
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("renders the email configuration dialog content when open", () => {
    h.open = true;
    render(<AuthenticationConfigLayout />);
    expect(screen.getByTestId("email-config")).toBeTruthy();
  });
});
