import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

// Radix menus rely on pointer-capture / scroll APIs jsdom does not implement.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (path: string) => `/app/tenant-1/${path}`,
  useTheme: () => ({ theme: "light" }),
}));

const statusToggleProps = vi.fn();
vi.mock("../sso-provider-status-toggle", () => ({
  SSoProviderStatusToggle: (props: { open: boolean }) => {
    statusToggleProps(props);
    return <div data-testid="status-toggle" data-open={String(props.open)} />;
  },
}));

const { SSOProviderCard, SSOProviderCardSkelton } = await import("./sso-provider-card");

type Config = Parameters<typeof SSOProviderCard>[0]["configuration"];

const makeConfig = (_overrides: Partial<Config> = {}): Config =>
  ({
    itemId: "cfg-1",
    provider: "google",
    label: "Google",
    description: "Sign in with Google",
    imageSrc: "/google.svg",
    imageSrcDark: "/google-dark.svg",
    isAvailable: true,
    isDisabled: false,
  }) as Config;

const renderCard = (configuration: Config) =>
  render(
    <MemoryRouter>
      <SSOProviderCard configuration={configuration} />
    </MemoryRouter>,
  );

describe("SSOProviderCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an Active badge for an available, enabled provider", () => {
    renderCard(makeConfig());
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("shows a Coming soon badge for an unavailable provider", () => {
    const configuration = {
      itemId: "",
      provider: "apple",
      label: "Apple",
      description: "Coming later",
      imageSrc: "/apple.svg",
      imageSrcDark: "/apple-dark.svg",
      isAvailable: false,
      isDisabled: false,
    } as Config;
    renderCard(configuration);
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.queryByText("Active")).toBeNull();
  });

  it("renders the loading skeleton variant", () => {
    const { container } = render(<SSOProviderCardSkelton />);
    // Skeleton blocks carry the animate-pulse utility class.
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("opens the status toggle from the Disable menu action", async () => {
    const user = userEvent.setup();
    renderCard(makeConfig({ isDisabled: false }));

    // Initially the toggle dialog is closed.
    expect(screen.getByTestId("status-toggle").getAttribute("data-open")).toBe("false");

    await user.click(screen.getByRole("button"));
    const disableItem = await screen.findByText("Disable");
    await user.click(disableItem);

    await waitFor(() => {
      expect(screen.getByTestId("status-toggle").getAttribute("data-open")).toBe("true");
    });
  });
});
