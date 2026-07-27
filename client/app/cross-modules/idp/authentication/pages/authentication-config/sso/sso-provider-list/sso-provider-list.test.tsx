import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isLoading: false,
  credentials: undefined as unknown,
  cardProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-auth-config", () => ({
  useGetAuthConfig: () => ({ isLoading: h.isLoading }),
}));
vi.mock("@blocks-idp/authentication/hooks/use-sso", () => ({
  useGetSsoCredentials: () => ({ data: h.credentials }),
}));
vi.mock("@blocks-idp/authentication/components/sso-provider-card/sso-provider-card", () => ({
  SSOProviderCard: (props: { configuration: { provider: string } }) => {
    h.cardProps.push(props);
    return <div data-testid="sso-card">{props.configuration.provider}</div>;
  },
  SSOProviderCardSkelton: () => <div data-testid="sso-skeleton" />,
}));

import { SSOProviderList } from "./sso-provider-list";

describe("SSOProviderList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.cardProps = [];
    h.isLoading = false;
    h.credentials = [];
  });

  it("renders skeletons while the auth config loads", () => {
    h.isLoading = true;
    render(<SSOProviderList />);
    expect(screen.getAllByTestId("sso-skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("sso-card")).toBeNull();
  });

  it("renders a card for every configured provider template", () => {
    render(<SSOProviderList />);
    expect(screen.getAllByTestId("sso-card").length).toBeGreaterThan(0);
  });

  it("merges saved credential data into the matching provider card", () => {
    h.credentials = [{ provider: "google", itemId: "cfg-google" }];
    render(<SSOProviderList />);
    const googleCard = h.cardProps.find(
      (p) => (p.configuration as { provider: string }).provider === "google",
    );
    expect((googleCard?.configuration as { itemId?: string }).itemId).toBe("cfg-google");
  });
});
