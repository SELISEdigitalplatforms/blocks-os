import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  mutateAsync: vi.fn(),
  navigate: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@blocks-idp/authentication/hooks/use-sso", () => ({
  useGetSsoCredentialById: () => ({ data: h.data }),
  useSaveSsoCredential: () => ({ mutateAsync: h.mutateAsync }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

const { makeFormMock } = vi.hoisted(() => {
  return {
    makeFormMock: (label: string) => ({
      [`SSOProviderConfig${label}Form`]: (props: { save: (d: unknown) => void }) =>
        React.createElement(
          "button",
          {
            "data-testid": `form-${label}`,
            onClick: () =>
              props.save({
                audience: "aud",
                clientId: "cid",
                clientSecret: "secret",
                userPermissions: [{ resource: "r1" }],
                userRoles: [{ slug: "role-1" }],
                provider: "google",
                redirectUrl: "https://redir",
              }),
          },
          `save ${label}`,
        ),
    }),
  };
});

vi.mock("./sso-provider-config-google-form", () => makeFormMock("Google"));
vi.mock("./sso-provider-config-github-form", () => makeFormMock("Github"));
vi.mock("./sso-provider-config-linkedin-form", () => makeFormMock("LinkedIN"));
vi.mock("./sso-provider-config-microsoft-form", () => makeFormMock("Microsoft"));
vi.mock("./sso-provider-config-x-form", () => makeFormMock("X"));
vi.mock("./sso-provider-config-blocks-own-sso-form", () => ({
  SSOProviderConfigOwnSSOForm: (props: { save: (d: unknown) => void }) => (
    <button data-testid="form-OwnSSO" onClick={() => props.save({ userRoles: [] })}>
      save OwnSSO
    </button>
  ),
}));

import { SsoProviderConfigForms } from "./sso-provider-config-forms";
import { SSO_PROVIDERS } from "@blocks-idp/authentication/constants/sso-providers.constant";

describe("SsoProviderConfigForms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.data = undefined;
    h.mutateAsync.mockResolvedValue({ isSuccess: true, itemId: "new-1" });
  });

  it("renders the provider-specific form for each supported provider", () => {
    const cases: Array<[SSO_PROVIDERS, string]> = [
      [SSO_PROVIDERS.google, "form-Google"],
      [SSO_PROVIDERS.github, "form-Github"],
      [SSO_PROVIDERS.linkedin, "form-LinkedIN"],
      [SSO_PROVIDERS.microsoft, "form-Microsoft"],
      [SSO_PROVIDERS.x, "form-X"],
      [SSO_PROVIDERS.ownsso, "form-OwnSSO"],
    ];
    for (const [provider, testId] of cases) {
      const { unmount } = render(<SsoProviderConfigForms provider={provider} id="" />);
      expect(screen.getByTestId(testId)).toBeTruthy();
      unmount();
    }
  });

  it("renders nothing for an unsupported provider", () => {
    const { container } = render(
      <SsoProviderConfigForms provider={SSO_PROVIDERS.apple} id="" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("saves a new credential, navigates and reports success", async () => {
    render(<SsoProviderConfigForms provider={SSO_PROVIDERS.google} id="" />);
    fireEvent.click(screen.getByTestId("form-Google"));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      initialPermissions: ["r1"],
      initialRoles: ["role-1"],
      projectKey: "tenant-1",
    });
    // A brand-new credential (no id) triggers navigation to the new id.
    expect(h.navigate).toHaveBeenCalled();
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("does not navigate when editing an existing credential", async () => {
    render(<SsoProviderConfigForms provider={SSO_PROVIDERS.google} id="existing-9" />);
    fireEvent.click(screen.getByTestId("form-Google"));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when the save fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "x" } });
    render(<SsoProviderConfigForms provider={SSO_PROVIDERS.google} id="" />);
    fireEvent.click(screen.getByTestId("form-Google"));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });
});
