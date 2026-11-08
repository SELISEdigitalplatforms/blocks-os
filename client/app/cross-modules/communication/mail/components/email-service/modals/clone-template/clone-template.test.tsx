import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  clone: vi.fn(),
  isPending: false,
  existing: { isLoading: false, isSuccess: true, data: ["en-US"] as string[] | undefined },
  languages: {
    isLoading: false,
    data: [
      { languageCode: "en-US", languageName: "English" },
      { languageCode: "lang-b", languageName: "Lang B" },
      { languageCode: "lang-c", languageName: "Lang C" },
    ],
  },
  showErrorToast: vi.fn(),
  toast: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useCloneTemplate: () => ({ mutateAsync: h.clone, isPending: h.isPending }),
  useGetTemplateLanguages: (...args: unknown[]) => {
    h.lookup(...args);
    return h.existing;
  },
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => h.languages,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));

import { CloneTemplateDialog } from "./clone-template";

const template = {
  itemId: "t-acme",
  name: "OrderConfirmation",
  language: "en-US",
  organizationId: "acme",
} as IEmailTemplate;

const renderDialog = (showOrganization = true) => {
  const onCloned = vi.fn();
  const onClose = vi.fn();
  render(
    <Dialog open>
      <CloneTemplateDialog
        template={template}
        organizationName="Acme Corp"
        showOrganization={showOrganization}
        onClose={onClose}
        onCloned={onCloned}
      />
    </Dialog>,
  );
  return { onCloned, onClose };
};

describe("CloneTemplateDialog (H10, C8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.existing = { isLoading: false, isSuccess: true, data: ["en-US"] };
    h.clone.mockResolvedValue({ isSuccess: true, itemId: "t-clone" });
  });

  it("shows Name and Organization read-only and looks up the name's languages in the organization", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Clone template" })).toBeTruthy();
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.value).toBe("OrderConfirmation");
    expect(name.readOnly).toBe(true);
    const organization = screen.getByLabelText("Organization") as HTMLInputElement;
    expect(organization.value).toBe("Acme Corp");
    expect(organization.readOnly).toBe(true);
    expect(screen.getByText("The clone keeps the name.")).toBeTruthy();
    expect(h.lookup).toHaveBeenCalledWith("OrderConfirmation", "acme", true);
  });

  it("disables the languages the name already has in the organization", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole("combobox", { name: /language/i }));
    const existing = await screen.findByRole("option", { name: "English · already exists" });
    expect(existing.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("option", { name: "Lang B" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("clones into the chosen language with the same name and reports the new id", async () => {
    const user = userEvent.setup();
    const { onCloned } = renderDialog();
    expect((screen.getByRole("button", { name: "Clone" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(screen.getByRole("combobox", { name: /language/i }));
    await user.click(await screen.findByRole("option", { name: "Lang B" }));
    await user.click(screen.getByRole("button", { name: "Clone" }));
    await waitFor(() =>
      expect(h.clone).toHaveBeenCalledWith({ itemId: "t-acme", language: "lang-b" }),
    );
    expect(onCloned).toHaveBeenCalledWith("t-clone");
  });

  it("shows the server's clone error from English keys", async () => {
    h.clone.mockRejectedValue({
      errors: { Language: "This template already exists in that language" },
    });
    const user = userEvent.setup();
    const { onCloned } = renderDialog();
    await user.click(screen.getByRole("combobox", { name: /language/i }));
    await user.click(await screen.findByRole("option", { name: "Lang C" }));
    await user.click(screen.getByRole("button", { name: "Clone" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    const args = h.showErrorToast.mock.calls[0][0];
    expect(args.errors).toEqual({ Language: "This template already exists in that language" });
    expect(args.customMessages["This template already exists in that language"]).toBe(
      "This template already exists in that language",
    );
    expect(onCloned).not.toHaveBeenCalled();
  });

  it("hides the Organization field with multi-org off (C13)", () => {
    renderDialog(false);
    expect(screen.queryByLabelText("Organization")).toBeNull();
    expect(screen.getByText("Only languages this template doesn't have yet.")).toBeTruthy();
  });
});
