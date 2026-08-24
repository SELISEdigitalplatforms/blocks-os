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
    expect(copied).toContain(`project ${TENANT_ID}`);
    expect(copied).toContain(
      "https://raw.githubusercontent.com/SELISEdigitalplatforms/blocks-skills/main/BOOTSTRAP.md",
    );
    expect(copied).not.toContain(MASKED_KEY);
    expect(h.showSuccessToast).toHaveBeenCalled();
  });
});
