import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Isolate the card so only the list's sort/branch logic is exercised.
vi.mock("./client-credential-card", () => ({
  ClientCredentialsCard: ({ clientCredential }: { clientCredential: { itemId: string; clientId?: string } }) => (
    <div data-testid="cc-card">{clientCredential.clientId ?? clientCredential.itemId}</div>
  ),
}));

import { ClientCredentialList } from "./client-credentials-list";
import type { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";

const make = (id: string, date: string, clientId: string): IClientCredentialsConfig =>
  ({ itemId: id, createdDate: date, clientId }) as IClientCredentialsConfig;

describe("ClientCredentialList", () => {
  it("renders the loading skeleton", () => {
    const { container } = render(<ClientCredentialList data={[]} isLoading />);
    expect(container.querySelectorAll("[class*='rounded']").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("cc-card")).toBeNull();
  });

  it("renders the empty state when there is no data", () => {
    render(<ClientCredentialList data={[]} isLoading={false} />);
    expect(screen.getByText("No client credentials yet")).toBeTruthy();
  });

  it("renders cards sorted by newest created date first", () => {
    render(
      <ClientCredentialList
        isLoading={false}
        data={[make("1", "2023-01-01", "older"), make("2", "2024-06-01", "newer")]}
      />,
    );
    const cards = screen.getAllByTestId("cc-card");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toBe("newer");
    expect(cards[1].textContent).toBe("older");
  });
});
