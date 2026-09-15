import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JwtSigningAlgorithm } from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const h = vi.hoisted(() => ({
  providers: undefined as unknown[] | undefined,
  isLoading: false,
  deleteProvider: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-third-party-jwt-provider", () => ({
  useGetThirdPartyJwtProviders: () => ({ data: h.providers, isLoading: h.isLoading }),
  useSaveThirdPartyJwtProvider: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteThirdPartyJwtProvider: () => ({ mutateAsync: h.deleteProvider }),
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
  hasSigningSecret: false,
  claimsMapping: { userId: "sub", email: "email", userName: "email", name: "name", roles: "" },
};

describe("Certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.providers = [];
    h.isLoading = false;
    h.deleteProvider = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("offers a way to add the first provider from the empty state", async () => {
    // With no provider configured there is no list to hang an action off, and the page header
    // carries none — so the empty state is the only entry point into the form.
    render(<Certificates />);

    const add = screen.getByRole("button", { name: "Add provider" });
    await userEvent.click(add);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Add provider" })).toBeTruthy(),
    );
  });

  it("lists a configured provider with its key source and an add action", () => {
    h.providers = [provider];
    render(<Certificates />);

    // The key shows twice: once on the provider card, once as the x-blocks-idp header value.
    expect(screen.getAllByText("auth0-web")).toHaveLength(2);
    expect(screen.getByText(provider.issuer)).toBeTruthy();
    expect(screen.getByText(provider.jwksUrl)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add provider" })).toBeTruthy();
  });

  it("deletes by item id, which is what revokes the stored secret", async () => {
    h.providers = [provider];
    render(<Certificates />);

    await userEvent.click(screen.getByRole("button", { name: "Delete auth0-web" }));

    await waitFor(() => expect(h.deleteProvider).toHaveBeenCalledWith("provider-1"));
  });
});
