import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  certificate: undefined as Record<string, unknown> | undefined,
  isLoading: false,
  jwtClaim: undefined as Record<string, unknown> | undefined,
  isJwtClaimLoading: false,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-identifier", () => ({
  useGetSavedPublicCertificates: () => ({
    isLoading: h.isLoading,
    data: h.certificate,
  }),
  useSavePublicCertificates: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useValidateJwksUrl: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-jwt-claim", () => ({
  useGetJwtClaim: () => ({ data: h.jwtClaim, isLoading: h.isJwtClaimLoading }),
  useAddJwtClaim: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  usePublicCertificateFile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));
vi.mock("jwt-decode", () => ({ jwtDecode: vi.fn(() => ({})) }));
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

describe("Certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.certificate = undefined;
    h.isLoading = false;
    h.jwtClaim = undefined;
    h.isJwtClaimLoading = false;
  });

  it("shows the loading skeleton while certificates load", () => {
    h.isLoading = true;
    const { container } = render(<Certificates />);
    // The skeleton renders placeholder blocks, not the configured card fields.
    expect(container.querySelector(".space-y-3")).toBeTruthy();
    expect(screen.queryByText("Provider")).toBeNull();
  });

  it("shows the empty configuration when nothing is configured", () => {
    h.certificate = { isConfigured: false };
    render(<Certificates />);
    expect(screen.queryByText("Provider")).toBeNull();
  });

  it("renders the configured certificate details", () => {
    h.certificate = {
      isConfigured: true,
      providerName: "Others",
      jwksUrl: "https://issuer.example.com/jwks",
      issuer: "https://issuer.example.com",
      audiences: ["aud-1", "aud-2"],
    };
    h.jwtClaim = { itemId: "claim-1" };
    render(<Certificates />);
    expect(screen.getByText("Provider")).toBeTruthy();
    expect(screen.getByText("Others")).toBeTruthy();
    expect(screen.getByText("https://issuer.example.com/jwks")).toBeTruthy();
    expect(screen.getByText("aud-1, aud-2")).toBeTruthy();
  });

  it("warns to map JWT claims when configured but no claim mapping exists", () => {
    h.certificate = {
      isConfigured: true,
      providerName: "Google",
      publicCertificatePath: "https://certs/x",
    };
    h.jwtClaim = undefined;
    render(<Certificates />);
    expect(screen.getByRole("button", { name: "Map JWT Claims" })).toBeTruthy();
    // Falls back to the public certificate path and dashes for missing fields.
    expect(screen.getByText("https://certs/x")).toBeTruthy();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});
