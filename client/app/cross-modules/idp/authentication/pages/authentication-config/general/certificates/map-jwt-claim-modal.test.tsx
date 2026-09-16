import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtSigningAlgorithm } from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const h = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@blocks-idp/authentication/hooks/use-third-party-jwt-provider", () => ({
  useSaveThirdPartyJwtProvider: () => ({ mutateAsync: h.save, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

import { MapJwtClaimModal } from "./map-jwt-claim-modal";

/** jwtDecode only reads the payload segment, so the header and signature can be anything. */
const tokenFor = (payload: Record<string, unknown>) => {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(payload)}.signature`;
};

const provider = {
  itemId: "provider-1",
  key: "auth0-web",
  providerName: "Auth0",
  isActive: true,
  issuer: "https://tenant.us.auth0.com/",
  audiences: ["https://api.example.com"],
  algorithms: [JwtSigningAlgorithm.RS256],
  jwksUrl: "https://tenant.us.auth0.com/.well-known/jwks.json",
  cookieKey: "app-session",
  hasSigningSecret: false,
  claimsMapping: { userId: "sub", email: "email", userName: "email", name: "name", roles: "" },
};

const renderDrawer = () =>
  render(<MapJwtClaimModal open onOpenChange={vi.fn()} provider={provider} />);

/** Pasted, not typed: a token is always pasted, and typing one key at a time is needlessly slow. */
const paste = async (value: string) => {
  await userEvent.click(screen.getByLabelText("JSON Web Token (JWT)"));
  await userEvent.paste(value);
};

const decode = async (payload: Record<string, unknown>) => {
  await paste(tokenFor(payload));
  await userEvent.click(screen.getByRole("button", { name: "Decode" }));
};

describe("MapJwtClaimModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.save = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("offers the claims the pasted token actually carries, nested ones by path", async () => {
    renderDrawer();
    await decode({ sub: "user-1", email: "a@b.c", realm_access: { roles: ["admin"] } });

    await userEvent.click(screen.getByRole("combobox", { name: "Roles" }));

    // A namespaced or nested claim is addressed by its full path, which is what gets stored.
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "realm_access.roles" })).toBeTruthy(),
    );
  });

  it("reports a token it cannot read instead of offering an empty list", async () => {
    renderDrawer();
    await paste("not-a-jwt");
    await userEvent.click(screen.getByRole("button", { name: "Decode" }));

    expect(screen.getByRole("status").textContent).toContain("not a readable JWT");
  });

  it("says decoding worked, so a valid token is not mistaken for a silent failure", async () => {
    renderDrawer();
    await decode({ sub: "user-1", email: "a@b.c" });

    expect(screen.getByRole("status").textContent).toContain("Decoded successfully");
    expect(screen.getByRole("status").textContent).toContain("2 claims found");
  });

  it("saves the whole provider, so fields this drawer does not edit survive", async () => {
    renderDrawer();
    await decode({ sub: "user-1", email: "a@b.c", preferred_username: "rafeen" });

    await userEvent.click(screen.getByRole("combobox", { name: "Username" }));
    await userEvent.click(
      await within(await screen.findByRole("listbox")).findByText("preferred_username"),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][0]).toMatchObject({
      itemId: "provider-1",
      key: "auth0-web",
      issuer: "https://tenant.us.auth0.com/",
      jwksUrl: "https://tenant.us.auth0.com/.well-known/jwks.json",
      // A save replaces the row, so dropping this would silently disable cookie-borne tokens.
      cookieKey: "app-session",
      claimsMapping: { userId: "sub", userName: "preferred_username" },
    });
  });

  it("never sends a signing secret, so the stored one is left alone", async () => {
    renderDrawer();
    await decode({ sub: "user-1" });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.save).toHaveBeenCalledTimes(1));
    expect(h.save.mock.calls[0][0].signingSecret).toBeUndefined();
  });
});
