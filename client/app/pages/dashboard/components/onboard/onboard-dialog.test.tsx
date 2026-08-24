import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IProject } from "@seliseblocks/genesis-os/models";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os/utils", () => ({
  showSuccessToast: (...args: unknown[]) => h.showSuccessToast(...args),
  showErrorToast: (...args: unknown[]) => h.showErrorToast(...args),
}));

import { OnboardDialog } from "./onboard-dialog";
import { maskValue } from "./onboard-guide";

const TENANT_ID = "tenant-key-123456";
const MASKED_KEY = maskValue(TENANT_ID);

const project = {
  name: "Acme App",
  tenantId: TENANT_ID,
  environment: "stg",
  applications: [
    {
      domain: "https://stg-a1b2c.seliseblocks.com",
      cookieDomain: "seliseblocks.com",
      isDomainVerified: true,
    },
  ],
} as IProject;

const renderDialog = (value: Partial<IProject> = {}) =>
  render(
    <OnboardDialog open onOpenChange={vi.fn()} project={{ ...project, ...value } as IProject} />,
  );

/**
 * `userEvent.setup()` installs its own clipboard stub, so the spy has to be
 * planted after it or the writes land on userEvent's copy instead.
 */
const setupUser = () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: h.writeText },
    configurable: true,
  });
  return user;
};

/** Clicks every code-block copy button and returns everything written to the clipboard. */
const copyAllCodeBlocks = async (user: ReturnType<typeof userEvent.setup>) => {
  const buttons = screen.getAllByRole("button", { name: "Copy bash command" });
  for (const button of buttons) {
    await user.click(button);
  }
  return h.writeText.mock.calls.map(([text]) => String(text));
};

describe("OnboardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.writeText.mockResolvedValue(undefined);
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  });

  it("renders the brief, with the key masked by default", () => {
    renderDialog();
    const rendered = () => document.body.textContent ?? "";
    expect(rendered()).toContain(MASKED_KEY);
    expect(rendered()).not.toContain(TENANT_ID);
    expect(rendered()).toContain(
      "https://raw.githubusercontent.com/SELISEdigitalplatforms/blocks-skills/main/BOOTSTRAP.md",
    );
  });

  it("reveals the key on demand", async () => {
    const user = setupUser();
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Show project key" }));
    expect(document.body.textContent).toContain(TENANT_ID);
    await user.click(screen.getByRole("button", { name: "Hide project key" }));
    expect(document.body.textContent).not.toContain(TENANT_ID);
  });

  it("copies the fully resolved brief, with the real key, while it is masked on screen", async () => {
    const user = setupUser();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Copy instructions" }));

    await waitFor(() => expect(h.writeText).toHaveBeenCalled());
    const copied = String(h.writeText.mock.calls[0][0]);
    expect(copied).toContain(`blocks use ${TENANT_ID}`);
    expect(copied).toContain("https://stg-a1b2c.seliseblocks.com:5173/login/callback");
    expect(copied).toContain("--blocks-api-url https://blocksapi.seliseblocks.com");
    expect(copied).not.toContain(MASKED_KEY);
    expect(copied).not.toMatch(/\{\{\w+\}\}/);
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("copies runnable commands from the code blocks even while the key is masked", async () => {
    const user = setupUser();
    renderDialog();

    const copies = await copyAllCodeBlocks(user);

    expect(copies.some((text) => text.includes(`blocks use ${TENANT_ID}`))).toBe(true);
    expect(copies.some((text) => text.includes(MASKED_KEY))).toBe(false);
  });

  it("warns and marks the gaps when the project has no domain", () => {
    renderDialog({ applications: [] });
    expect(screen.getByRole("alert").textContent).toContain("No domain configured yet");
    // The marker has to survive markdown rendering, not just string substitution.
    expect(document.body.textContent).toContain("<not configured>");
  });

  it("offers a domain picker only when the project has more than one domain", () => {
    renderDialog();
    expect(screen.queryByRole("combobox", { name: "Select domain" })).toBeNull();

    renderDialog({
      applications: [
        ...project.applications,
        { domain: "https://app.acme.com", cookieDomain: "acme.com", isDomainVerified: true },
      ],
    });
    expect(screen.getByRole("combobox", { name: "Select domain" })).toBeTruthy();
  });
});
