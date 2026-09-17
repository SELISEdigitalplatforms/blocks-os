import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JwtSigningAlgorithm,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const h = vi.hoisted(() => ({
  saveProvider: vi.fn(),
  uploadCertificate: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-idp/authentication/hooks/use-third-party-jwt-provider", () => ({
  useSaveThirdPartyJwtProvider: () => ({ mutateAsync: h.saveProvider, isPending: false }),
}));
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  usePublicCertificateFile: () => ({ mutateAsync: h.uploadCertificate, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: vi.fn(),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));

import { ProviderFormModal } from "./provider-form-modal";

const UPLOADED_URL = "https://cdn.example.com/certificates/tenant-1_3rdparty_provider-1";
/** Extension-less, as a blob uploaded before the URL carried one would be. */
const LEGACY_URL = "https://cdn.example.com/certificates/tenant-1_3rdparty";

const certificateProvider = (
  overrides: Partial<ThirdPartyJwtProvider> = {},
): ThirdPartyJwtProvider => ({
  itemId: "provider-1",
  key: "int***ral",
  providerName: "Others",
  isActive: true,
  issuer: "https://sso.internal.example.com/",
  audiences: ["https://api.example.com"],
  algorithms: [JwtSigningAlgorithm.RS256],
  jwksUrl: "",
  publicCertificatePath: `${UPLOADED_URL}.pfx`,
  cookieKey: "",
  certificateSubject: "",
  certificateThumbprint: "",
  certificateNotAfter: null,
  hasSigningSecret: false,
  hasCertificatePassword: false,
  claimsMapping: { userId: "sub", email: "email", userName: "email", name: "name", roles: "" },
  ...overrides,
});

const renderForm = (existing: ThirdPartyJwtProvider | null = null) =>
  render(
    <ProviderFormModal
      open
      onOpenChange={vi.fn()}
      existing={existing}
      projectKey="tenant-1"
      siblingIssuers={[]}
    />,
  );

/** Picks an option out of a shadcn Select, which renders a listbox rather than a native select. */
const chooseFromSelect = async (triggerName: RegExp, optionName: string) => {
  await userEvent.click(screen.getByRole("combobox", { name: triggerName }));
  await userEvent.click(await screen.findByRole("option", { name: optionName }));
};

const certificateFile = (name: string) =>
  new File(["-----BEGIN CERTIFICATE-----"], name, { type: "application/x-pkcs12" });

/**
 * The dropzone's file input carries no accessible name, so there is no role or label to find it
 * by. Takes the last one in the document: the dialog is portaled outside render()'s container, so
 * document order is the only thing tying an input to the render that produced it.
 */
const fileInput = () => {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  return inputs[inputs.length - 1];
};

describe("ProviderFormModal key source", () => {
  // Explicit rather than relying on the automatic hook: every test in here renders the same
  // always-open dialog, and a leftover one leaves a second dropzone in the document.
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    h.saveProvider = vi.fn().mockResolvedValue({ isSuccess: true });
    h.uploadCertificate = vi.fn().mockResolvedValue({ downloadUrl: UPLOADED_URL });
  });

  it.each(["Auth0", "Keycloak", "Okta", "Azure", "Others"])(
    "offers both key sources for %s on an asymmetric algorithm",
    async (provider) => {
      // The choice follows the algorithm family, never the brand. A self-hosted Keycloak often
      // has no JWKS this platform can reach, so gating on the name would lock it out.
      renderForm();

      await chooseFromSelect(/provider/i, provider);

      expect(screen.getByLabelText("JWKS URL")).toBeTruthy();
      expect(screen.getByLabelText("Upload certificate")).toBeTruthy();
    },
  );

  it("defaults to the JWKS URL, which survives key rotation", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Auth0");

    expect(screen.getByPlaceholderText(/well-known\/jwks\.json/)).toBeTruthy();
    expect(screen.queryByText(/Click to upload or drag and drop/)).toBeNull();
  });

  it("swaps the JWKS field for an uploader once the certificate source is picked", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Auth0");
    await userEvent.click(screen.getByLabelText("Upload certificate"));

    expect(screen.queryByPlaceholderText(/well-known\/jwks\.json/)).toBeNull();
    expect(screen.getByText(/Click to upload or drag and drop/)).toBeTruthy();
  });

  it("hides the certificate option entirely for an HMAC algorithm", async () => {
    // HMAC verifies with the shared secret. A certificate alongside it would be a second,
    // unrelated signing authority, and the server refuses one.
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await chooseFromSelect(/signing algorithm/i, "HS256");

    expect(screen.queryByText("Upload certificate")).toBeNull();
    expect(screen.getByLabelText(/Signing secret/)).toBeTruthy();
  });

  it("returns to the certificate source when the algorithm goes back to asymmetric", async () => {
    // The choice is remembered rather than reset, so flipping the algorithm to inspect the secret
    // field does not silently discard it.
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await userEvent.click(screen.getByLabelText("Upload certificate"));
    await chooseFromSelect(/signing algorithm/i, "HS256");
    await chooseFromSelect(/signing algorithm/i, "RS256");

    expect(screen.getByText(/Click to upload or drag and drop/)).toBeTruthy();
  });

  it("keeps the signing secret field for HS256, as it always did", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Auth0");
    await chooseFromSelect(/signing algorithm/i, "HS256");

    expect(screen.getByLabelText(/Signing secret/)).toBeTruthy();
    expect(screen.queryByLabelText(/JWKS URL/i)).toBeNull();
  });

  it("uploads the certificate and saves the URL it hands back", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await userEvent.type(screen.getByLabelText(/^Key/), "internal");
    await userEvent.type(screen.getByLabelText(/^Issuer/), "https://sso.internal/");
    await userEvent.click(screen.getByLabelText("Upload certificate"));

    await userEvent.upload(fileInput(), certificateFile("internal-sso.pfx"));
    await userEvent.type(screen.getByLabelText(/Passphrase/), "pfx-pass");
    await userEvent.click(screen.getByRole("button", { name: "Add provider" }));

    await waitFor(() => expect(h.uploadCertificate).toHaveBeenCalledTimes(1));

    expect(h.uploadCertificate.mock.calls[0][0]).toMatchObject({ TenantId: "tenant-1" });
    // Scoped to a provider, so a second provider's upload cannot replace this one's certificate.
    expect(h.uploadCertificate.mock.calls[0][0].ProviderRef).toBeTruthy();

    await waitFor(() => expect(h.saveProvider).toHaveBeenCalledTimes(1));

    const saved = h.saveProvider.mock.calls[0][0];
    expect(saved.publicCertificatePath).toBe(UPLOADED_URL);
    expect(saved.publicCertificatePassword).toBe("pfx-pass");
    // Exactly one key source may be sent.
    expect(saved.jwksUrl).toBeUndefined();
    expect(saved.signingSecret).toBeUndefined();
  }, 15000);

  it("clears any stored passphrase when a fresh certificate arrives without one", async () => {
    // The upload reuses the provider's URL, so the server cannot tell the file changed from the
    // path alone — leaving the old passphrase in place would fail every load of the new file.
    renderForm(certificateProvider({ hasCertificatePassword: true }));

    await userEvent.upload(fileInput(), certificateFile("rotated.pfx"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(h.saveProvider).toHaveBeenCalledTimes(1));

    const saved = h.saveProvider.mock.calls[0][0];
    expect(saved.clearCertificatePassword).toBe(true);
    expect(saved.publicCertificatePassword).toBeUndefined();
  });

  it("keeps the stored certificate and passphrase when neither is touched", async () => {
    renderForm(certificateProvider({ hasCertificatePassword: true }));

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(h.saveProvider).toHaveBeenCalledTimes(1));

    expect(h.uploadCertificate).not.toHaveBeenCalled();

    const saved = h.saveProvider.mock.calls[0][0];
    expect(saved.publicCertificatePath).toBe(`${UPLOADED_URL}.pfx`);
    // Empty means untouched, so the stored passphrase survives.
    expect(saved.publicCertificatePassword).toBeUndefined();
    expect(saved.clearCertificatePassword).toBeUndefined();
  });

  it("opens an existing certificate provider on the certificate source", async () => {
    renderForm(certificateProvider());

    expect(screen.getByText(/A PKCS#12 certificate is configured/)).toBeTruthy();
    expect(screen.queryByPlaceholderText(/well-known\/jwks\.json/)).toBeNull();
  });

  it("keeps a stored passphrase manageable when the blob URL carries no extension", async () => {
    // The blob is named after the tenant and provider, so its URL says nothing about the file
    // type. Going by the path alone hid the field on exactly the providers that had a passphrase.
    renderForm(
      certificateProvider({ publicCertificatePath: LEGACY_URL, hasCertificatePassword: true }),
    );

    expect(screen.getByLabelText(/Passphrase/)).toBeTruthy();
    expect(screen.getByText(/A passphrase is stored/)).toBeTruthy();
  });

  it("keeps the passphrase usable for an extension-less blob, whose type is unknown", async () => {
    // A blob stored before the URL carried an extension could be a protected .pfx. Disabling the
    // field on that guess would lock out a passphrase the provider genuinely needs.
    renderForm(
      certificateProvider({ publicCertificatePath: LEGACY_URL, hasCertificatePassword: false }),
    );

    const passphrase = screen.getByLabelText(/Passphrase/) as HTMLInputElement;
    expect(passphrase.disabled).toBe(false);
  });

  it("offers the passphrase field before any file is chosen, so the option is discoverable", async () => {
    // It used to appear only once a .pfx happened to be selected, which meant nothing on screen
    // told anyone with a protected certificate that they could use it here at all.
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await userEvent.click(screen.getByLabelText("Upload certificate"));

    const passphrase = screen.getByLabelText(/Passphrase/) as HTMLInputElement;
    expect(passphrase).toBeTruthy();
    expect(passphrase.disabled).toBe(false);
    expect(screen.getByText(/Only for a password-protected PKCS#12/)).toBeTruthy();
  });

  it("advises rather than blocks for a bare certificate", async () => {
    // Says a .crt has nothing to unlock, but stays editable: the file name is the only signal
    // there is, and a protected .pfx saved under a .crt name must not become unrecoverable.
    renderForm(certificateProvider({ publicCertificatePath: `${UPLOADED_URL}.crt` }));

    const passphrase = screen.getByLabelText(/Passphrase/) as HTMLInputElement;
    expect(passphrase.disabled).toBe(false);
    expect(screen.getByText(/holds only a public key/)).toBeTruthy();
  });

  it("enables the passphrase once a PKCS#12 is chosen", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await userEvent.click(screen.getByLabelText("Upload certificate"));
    await userEvent.upload(fileInput(), certificateFile("protected.pfx"));

    const passphrase = screen.getByLabelText(/Passphrase/) as HTMLInputElement;
    expect(passphrase.disabled).toBe(false);
    expect(screen.getByText(/may be password protected/)).toBeTruthy();
  });

  it("refuses to save a certificate source with no file and nothing stored", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await userEvent.type(screen.getByLabelText(/^Key/), "internal");
    await userEvent.type(screen.getByLabelText(/^Issuer/), "https://sso.internal/");
    await userEvent.click(screen.getByLabelText("Upload certificate"));
    await userEvent.click(screen.getByRole("button", { name: "Add provider" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());

    expect(h.uploadCertificate).not.toHaveBeenCalled();
    expect(h.saveProvider).not.toHaveBeenCalled();
  });

  it("does not save when the certificate could not be stored", async () => {
    // Saving the provider anyway would point it at a URL that holds nothing, and the symptom
    // would be a 401 on a perfectly valid token.
    h.uploadCertificate = vi.fn().mockResolvedValue({ downloadUrl: "" });

    renderForm(certificateProvider());

    await userEvent.upload(fileInput(), certificateFile("rotated.pfx"));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());

    expect(h.saveProvider).not.toHaveBeenCalled();
  });

  it("requires a JWKS URL when that is the chosen source", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Auth0");
    await userEvent.type(screen.getByLabelText(/^Key/), "auth0-web");
    await userEvent.type(screen.getByLabelText(/^Issuer/), "https://t.auth0.com/");
    await userEvent.click(screen.getByRole("button", { name: "Add provider" }));

    expect(await screen.findByText(/A JWKS URL is required/)).toBeTruthy();
    expect(h.saveProvider).not.toHaveBeenCalled();
  });

  // ─── issuer-less providers ─────────────────────────────────────────────────

  it("saves a provider with no issuer at all", async () => {
    // For a third party that emits no iss claim. The provider is reached by x-blocks-idp, so its
    // key is what names it, and the issuer field is genuinely optional.
    renderForm();

    await chooseFromSelect(/provider/i, "Others");
    await chooseFromSelect(/signing algorithm/i, "HS256");
    await userEvent.type(screen.getByLabelText(/^Key/), "recyclium");
    await userEvent.type(screen.getByLabelText(/Signing secret/), "the-secret");
    await userEvent.click(screen.getByRole("button", { name: "Add provider" }));

    await waitFor(() => expect(h.saveProvider).toHaveBeenCalledTimes(1));

    const saved = h.saveProvider.mock.calls[0][0];
    expect(saved.issuer).toBe("");
    expect(saved.signingSecret).toBe("the-secret");
  }, 15000);

  it("says a blank issuer accepts only tokens that name no issuer", async () => {
    renderForm();

    await chooseFromSelect(/provider/i, "Others");

    expect(
      screen.getByText(/Tokens carrying any issuer will not reach this provider/),
    ).toBeTruthy();
  });

  it("warns that the header becomes necessary when another provider is already issuer-less", async () => {
    render(
      <ProviderFormModal
        open
        onOpenChange={vi.fn()}
        existing={null}
        projectKey="tenant-1"
        siblingIssuers={[""]}
      />,
    );

    await chooseFromSelect(/provider/i, "Others");

    expect(screen.getByText(/callers must send x-blocks-idp/)).toBeTruthy();
  });

  it("does not demand audiences for a blank issuer", async () => {
    // The shared-issuer rule must not fire here: a token with no iss carries no aud either, so
    // asking for audiences would build a provider nothing can reach.
    render(
      <ProviderFormModal
        open
        onOpenChange={vi.fn()}
        existing={null}
        projectKey="tenant-1"
        siblingIssuers={[""]}
      />,
    );

    await chooseFromSelect(/provider/i, "Others");

    expect(screen.queryByText(/already uses this issuer/)).toBeNull();
  });

  it("still demands audiences when a real issuer is shared", async () => {
    render(
      <ProviderFormModal
        open
        onOpenChange={vi.fn()}
        existing={null}
        projectKey="tenant-1"
        siblingIssuers={["https://t.auth0.com/"]}
      />,
    );

    await chooseFromSelect(/provider/i, "Auth0");
    await userEvent.type(screen.getByLabelText(/^Issuer/), "https://t.auth0.com/");

    expect(await screen.findByText(/already uses this issuer/)).toBeTruthy();
  }, 15000);
});
