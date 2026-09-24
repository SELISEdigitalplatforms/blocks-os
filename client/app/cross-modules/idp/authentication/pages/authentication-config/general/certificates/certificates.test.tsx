import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtSigningAlgorithm } from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const h = vi.hoisted(() => ({
  providers: undefined as unknown[] | undefined,
  isLoading: false,
  deleteProvider: vi.fn(),
  saveProvider: vi.fn(),
  uploadCertificate: vi.fn(),
  updateTrust: vi.fn(),
  isTrustPending: false,
  projectData: { data: { isThirdPartyJwtEnabled: false } } as {
    data: { isThirdPartyJwtEnabled: boolean };
  } | undefined,
  isProjectLoading: false,
  isProjectError: false,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
  // The ui-kit tooltip re-exports these, so the mock has to carry them or every row action
  // renders as undefined.
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));
vi.mock("@blocks-idp/authentication/hooks/use-third-party-jwt-provider", () => ({
  useGetThirdPartyJwtProviders: () => ({ data: h.providers, isLoading: h.isLoading }),
  useSaveThirdPartyJwtProvider: () => ({ mutateAsync: h.saveProvider, isPending: false }),
  useDeleteThirdPartyJwtProvider: () => ({ mutateAsync: h.deleteProvider }),
  useUpdateThirdPartyJwtEnabled: () => ({
    mutateAsync: h.updateTrust,
    isPending: h.isTrustPending,
  }),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProject: () => ({
    data: h.projectData,
    isLoading: h.isProjectLoading,
    isError: h.isProjectError,
  }),
}));
// The provider form reaches for this so an "Others" provider can upload a certificate instead of
// naming a JWKS URL. Unmocked it calls useMutation, which needs a QueryClientProvider this page
// is never rendered inside.
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  usePublicCertificateFile: () => ({ mutateAsync: h.uploadCertificate, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));
vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsBoolean: parser,
    parseAsString: parser,
    useQueryState: (_key: string, opts: { defaultValue: unknown }) =>
      React.useState(opts.defaultValue),
  };
});

import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { Certificates } from "./certificates";

const provider = {
  itemId: "provider-1",
  key: "auth0-web",
  providerName: "Auth0",
  isActive: true,
  issuer: "https://tenant.us.auth0.com/",
  audiences: ["https://api.example.com"],
  algorithms: [JwtSigningAlgorithm.RS256],
  jwksUrl: "https://tenant.us.auth0.com/.well-known/jwks.json",
  publicCertificatePath: "",
  certificateSubject: "",
  certificateThumbprint: "",
  certificateNotAfter: null,
  hasSigningSecret: false,
  hasCertificatePassword: false,
  cookieKey: "",
  claimsMapping: { userId: "sub", email: "email", userName: "email", name: "name", roles: "" },
};

const trustSwitch = () =>
  screen.getByRole("switch", { name: "Accept tokens from external identity providers" });

describe("Certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.providers = [];
    h.isLoading = false;
    h.deleteProvider = vi.fn().mockResolvedValue({ isSuccess: true });
    h.saveProvider = vi.fn().mockResolvedValue({ isSuccess: true });
    h.uploadCertificate = vi
      .fn()
      .mockResolvedValue({ downloadUrl: "https://cdn.example.com/certificates/tenant-1_3rdparty" });
    h.updateTrust = vi.fn().mockResolvedValue({ isSuccess: true });
    h.isTrustPending = false;
    h.projectData = { data: { isThirdPartyJwtEnabled: false } };
    h.isProjectLoading = false;
    h.isProjectError = false;
  });

  it("offers a way to add the first provider from the empty state", async () => {
    // With no provider configured there is no list to hang an action off, and the page header
    // carries none — so the empty state is the only entry point into the form.
    render(<Certificates />);

    const add = screen.getByRole("button", { name: "Add provider" });
    await userEvent.click(add);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Add provider" })).toBeTruthy());
  });

  it("names the key source of a certificate-backed provider rather than an em dash", () => {
    // Regression: the card read `jwksUrl || "—"`, so a provider validating perfectly well
    // against an uploaded certificate rendered as though nothing had been configured.
    h.providers = [
      {
        ...provider,
        jwksUrl: "",
        publicCertificatePath: "https://cdn.example.com/certificates/tenant-1_3rdparty_p1.crt",
      },
    ];

    render(<Certificates />);

    expect(screen.getByText("Certificate (.crt)")).toBeTruthy();
  });

  it("lists a configured provider with its key source and an add action", () => {
    h.providers = [provider];
    render(<Certificates />);

    // Integration details live on the details page now, so the list shows the key exactly once.
    expect(screen.getAllByText("auth0-web")).toHaveLength(1);
    expect(screen.getByText(provider.issuer)).toBeTruthy();
    expect(screen.getByText(provider.jwksUrl)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add provider" })).toBeTruthy();
  });

  it("opens claim mapping for the provider whose row was clicked", async () => {
    // Mapping is deliberately not part of the create form: it is picked from a real token here,
    // once the provider exists and can issue one.
    h.providers = [provider];
    render(<Certificates />);

    await userEvent.click(screen.getByRole("button", { name: /Map JWT claim/ }));

    await waitFor(() => expect(screen.getByLabelText("JSON Web Token (JWT)")).toBeTruthy());
    expect(screen.getByText("Mapping table")).toBeTruthy();
  });

  it("opens one provider's details, with the headers a caller has to send", async () => {
    h.providers = [provider];
    render(<Certificates />);

    await userEvent.click(screen.getByRole("button", { name: "View details for auth0-web" }));

    await waitFor(() => expect(screen.getByText("Claim mapping")).toBeTruthy());
    // Each header is offered for copying, which is the part a caller actually needs.
    expect(screen.getByRole("button", { name: "Copy x-blocks-key" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy x-blocks-idp" })).toBeTruthy();
    expect(screen.getByText("Authorization")).toBeTruthy();
    // The sample is copyable as a whole, and carries x-blocks-idp whether or not it is required,
    // so a caller who copies it once does not have to come back and add a header later.
    expect(screen.getByRole("button", { name: "Copy example request" })).toBeTruthy();
    const curl = screen.getByText(/^curl /);
    expect(curl.textContent).toContain("/iam/me");
    expect(curl.textContent).toContain("x-blocks-key: tenant-1");
    expect(curl.textContent).toContain("x-blocks-idp: auth0-web");
  });

  it("disables a provider from the list, once confirmed", async () => {
    h.providers = [provider];
    render(<Certificates />);

    await userEvent.click(screen.getByRole("button", { name: "Disable auth0-web" }));

    // Asked about first: disabling stops every token from this provider being accepted.
    await waitFor(() => expect(screen.getByText("Disable provider")).toBeTruthy());
    expect(h.saveProvider).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Disable", exact: true }));

    await waitFor(() => expect(h.saveProvider).toHaveBeenCalledTimes(1));
    expect(h.saveProvider.mock.calls[0][0]).toMatchObject({
      itemId: "provider-1",
      isActive: false,
      // The save replaces the row, so the fields the toggle does not touch have to ride along.
      issuer: provider.issuer,
      jwksUrl: provider.jwksUrl,
      claimsMapping: provider.claimsMapping,
    });
  });

  it("offers to enable a provider that is off", async () => {
    h.providers = [{ ...provider, isActive: false }];
    render(<Certificates />);

    await userEvent.click(screen.getByRole("button", { name: "Enable auth0-web" }));
    await waitFor(() => expect(screen.getByText("Enable provider")).toBeTruthy());

    await userEvent.click(screen.getByRole("button", { name: "Enable", exact: true }));

    await waitFor(() => expect(h.saveProvider).toHaveBeenCalledTimes(1));
    expect(h.saveProvider.mock.calls[0][0].isActive).toBe(true);
  });

  it("deletes by item id, which is what revokes the stored secret", async () => {
    h.providers = [provider];
    render(<Certificates />);

    await userEvent.click(screen.getByRole("button", { name: "Delete auth0-web" }));

    await waitFor(() => expect(h.deleteProvider).toHaveBeenCalledWith("provider-1"));
  });

  describe("external IdP trust toggle", () => {
    it("renders unchecked and disabled with helper text when there are no active providers (C1)", () => {
      h.providers = [];
      h.projectData = { data: { isThirdPartyJwtEnabled: false } };
      render(<Certificates />);

      const sw = trustSwitch();
      expect(sw.getAttribute("data-state")).toBe("unchecked");
      expect(sw).toHaveProperty("disabled", true);
      expect(
        screen.getByText("Add an active provider to enable third-party token trust."),
      ).toBeTruthy();
    });

    it("keeps the switch disabled when every provider is inactive (C1)", () => {
      h.providers = [{ ...provider, isActive: false }];
      h.projectData = { data: { isThirdPartyJwtEnabled: false } };
      render(<Certificates />);

      expect(trustSwitch()).toHaveProperty("disabled", true);
    });

    it("reflects stored on/off from Project/Get and enables when an active provider exists (H1/H2)", () => {
      h.providers = [provider];
      h.projectData = { data: { isThirdPartyJwtEnabled: true } };
      render(<Certificates />);

      const sw = trustSwitch();
      expect(sw.getAttribute("data-state")).toBe("checked");
      expect(sw).toHaveProperty("disabled", false);
    });

    it("stays enabled when checked even if active count is zero so trust can be turned off (H3)", () => {
      h.providers = [];
      h.projectData = { data: { isThirdPartyJwtEnabled: true } };
      render(<Certificates />);

      const sw = trustSwitch();
      expect(sw.getAttribute("data-state")).toBe("checked");
      expect(sw).toHaveProperty("disabled", false);
    });

    it("calls updateThirdPartyJwtEnabled and toasts on success (H4/H5)", async () => {
      h.providers = [provider];
      h.projectData = { data: { isThirdPartyJwtEnabled: false } };
      render(<Certificates />);

      await userEvent.click(trustSwitch());

      await waitFor(() => expect(h.updateTrust).toHaveBeenCalledWith(true));
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "External identity provider trust enabled",
      });
    });

    it("surfaces no_active_provider through the error toast without flipping state (C2)", async () => {
      h.providers = [provider];
      h.projectData = { data: { isThirdPartyJwtEnabled: false } };
      h.updateTrust = vi.fn().mockResolvedValue({
        isSuccess: false,
        errors: { no_active_provider: "No active provider" },
      });
      render(<Certificates />);

      await userEvent.click(trustSwitch());

      await waitFor(() => expect(h.updateTrust).toHaveBeenCalled());
      expect(showErrorToast).toHaveBeenCalledWith({
        errors: { no_active_provider: "No active provider" },
      });
      expect(showSuccessToast).not.toHaveBeenCalled();
      // Still unchecked — server state only (no optimistic flip).
      expect(trustSwitch().getAttribute("data-state")).toBe("unchecked");
    });

    it("disables the switch while project or providers are loading (C3)", () => {
      h.isLoading = true;
      h.isProjectLoading = true;
      render(<Certificates />);

      expect(trustSwitch()).toHaveProperty("disabled", true);
    });

    it("shows an error state for the switch row when Project/Get fails (C4)", () => {
      h.providers = [provider];
      h.isProjectError = true;
      h.projectData = undefined;
      render(<Certificates />);

      expect(screen.getByRole("alert").textContent).toMatch(/Could not load third-party token trust/);
      // Provider list still renders independently.
      expect(screen.getAllByText("auth0-web").length).toBeGreaterThan(0);
    });

    it("disables the switch while the mutation is in flight (H6)", () => {
      h.providers = [provider];
      h.projectData = { data: { isThirdPartyJwtEnabled: false } };
      h.isTrustPending = true;
      render(<Certificates />);

      expect(trustSwitch()).toHaveProperty("disabled", true);
    });
  });
});
