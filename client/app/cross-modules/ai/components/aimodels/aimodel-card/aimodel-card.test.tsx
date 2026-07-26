import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ navigate: vi.fn(), scoped: (p: string) => `/scoped/${p}` }));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({ useScopedPath: () => h.scoped }));

import { ProviderCard } from "./aimodel-card";

const provider = (overrides: Record<string, unknown> = {}) =>
  ({ Provider: "openai", Description: "OpenAI models", ...overrides }) as never;

describe("ProviderCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the provider name, description and logo for a known provider", () => {
    render(<ProviderCard {...provider()} />);
    expect(screen.getByText("OpenAI models")).toBeTruthy();
    const img = screen.getByAltText("openai") as HTMLImageElement;
    expect(img.src).toContain("openai.png");
    expect(screen.getByText("My Key")).toBeTruthy();
  });

  it("shows the initials fallback for an unmapped provider", () => {
    render(<ProviderCard {...provider({ Provider: "zeta", Description: "d" })} />);
    expect(screen.getByText("ZE")).toBeTruthy();
    expect(screen.queryByAltText("zeta")).toBeNull();
  });

  it("labels a custom provider as My Model", () => {
    render(<ProviderCard {...provider({ Provider: "CUSTOM", Description: "d" })} />);
    expect(screen.getByText("My Model")).toBeTruthy();
  });

  it("navigates to the scoped provider path when the card is clicked", async () => {
    const user = userEvent.setup();
    render(<ProviderCard {...provider()} />);
    await user.click(screen.getByText("OpenAI models"));
    expect(h.navigate).toHaveBeenCalledWith("/scoped/secret-management/ai-models/openai");
  });

  it("navigates from the chevron button without double firing", async () => {
    const user = userEvent.setup();
    render(<ProviderCard {...provider()} />);
    await user.click(screen.getByRole("button"));
    expect(h.navigate).toHaveBeenCalledTimes(1);
  });
});
