import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShareChoice } from "@blocks-communication/mail/constants/share-organizations";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  saveTemplate: vi.fn(),
  copy: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
  basicMounts: 0,
  choice: null as ShareChoice | null,
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast, showErrorToast: h.showErrorToast }));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ mutateAsync: h.saveTemplate, isPending: false }),
}));
vi.mock("@blocks-communication/mail/hooks/use-template-copy", () => ({
  useCopyTemplateToOrganizations: () => ({ mutateAsync: h.copy, isPending: false }),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <nav /> }));

// Step 1: buttons that set the share choice the way the share block does, then save.
vi.mock(
  "@blocks-communication/mail/components/email-service/basic-information/basic-information",
  () => ({
    default: ({
      onSaveSuccess,
      onValidityChange,
      onShareChoiceChange,
      shareChoice,
      actions,
    }: {
      onSaveSuccess?: (data: { name: string; itemId: string }) => void;
      onValidityChange: (valid: boolean) => void;
      onShareChoiceChange?: (choice: ShareChoice) => void;
      shareChoice?: ShareChoice;
      actions?: React.ReactNode;
    }) => {
      h.basicMounts += 1;
      h.choice = shareChoice ?? null;
      return (
        <div>
          <button type="button" onClick={() => onValidityChange(true)}>
            make-valid
          </button>
          <button
            type="button"
            onClick={() =>
              onShareChoiceChange?.({
                copy: true,
                allOrganizations: false,
                selected: new Map([
                  ["acme", "Acme Corp"],
                  ["globex", "Globex"],
                  ["initech", "Initech"],
                ]),
                existing: "keep",
              })
            }
          >
            share-three
          </button>
          <button
            type="button"
            onClick={() =>
              onShareChoiceChange?.({
                copy: true,
                allOrganizations: false,
                selected: new Map(),
                existing: "keep",
              })
            }
          >
            share-none
          </button>
          <button
            type="button"
            onClick={() =>
              onShareChoiceChange?.({
                copy: true,
                allOrganizations: true,
                selected: new Map(),
                existing: "replace",
              })
            }
          >
            share-all
          </button>
          <button
            type="button"
            onClick={() => onSaveSuccess?.({ name: "Welcome", itemId: "tpl-1" })}
          >
            submit-basic
          </button>
          {actions}
        </div>
      );
    },
  }),
);
vi.mock("@blocks-communication/mail/components/mailcraft-editor/mailcraft-editor", () => ({
  default: ({ onSave }: { onSave: (d: { htmlFile: string }) => void }) => (
    <button type="button" onClick={() => onSave({ htmlFile: "<p>x</p>" })}>
      editor-save
    </button>
  ),
}));

const { default: NewCommunication } = await import("./new-communication");

const toStep2 = async (user: ReturnType<typeof userEvent.setup>, share?: string) => {
  render(<NewCommunication />);
  if (share) await user.click(screen.getByRole("button", { name: share }));
  await user.click(screen.getByRole("button", { name: "submit-basic" }));
  await screen.findByRole("button", { name: "editor-save" });
};

describe("NewCommunication: copy to organizations on create (SPEC33 H7, C10, §6.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.basicMounts = 0;
    h.choice = null;
    h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "tpl-1" });
    h.copy.mockResolvedValue({ isSuccess: true, itemId: "job-1" });
  });

  it("names the chosen organizations in step 2 and copies only after the save (H7)", async () => {
    const user = userEvent.setup();
    await toStep2(user, "share-three");
    expect(screen.getByRole("status").textContent).toContain(
      "When you save, this template is also copied to 3 organizations: Acme Corp, Globex and Initech. Copying runs in the background; you get a notification when it's done.",
    );
    expect(h.copy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "editor-save" }));
    await waitFor(() => expect(h.copy).toHaveBeenCalled());
    expect(h.saveTemplate.mock.invocationCallOrder[0]).toBeLessThan(
      h.copy.mock.invocationCallOrder[0],
    );
    expect(h.copy.mock.calls[0][0]).toEqual({
      templateId: "tpl-1",
      allOrganizations: false,
      organizationIds: ["acme", "globex", "initech"],
      existing: "keep",
    });
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Copying started. You'll get a notification when it's done.",
      }),
    );
    expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management/communications/tpl-1");
  });

  it("copies to all organizations with the chosen replace (H3, H5)", async () => {
    const user = userEvent.setup();
    await toStep2(user, "share-all");
    expect(screen.getByRole("status").textContent).toContain(
      "When you save, this template is also copied to all organizations.",
    );
    await user.click(screen.getByRole("button", { name: "editor-save" }));
    await waitFor(() => expect(h.copy).toHaveBeenCalled());
    expect(h.copy.mock.calls[0][0]).toEqual({
      templateId: "tpl-1",
      allOrganizations: true,
      existing: "replace",
    });
  });

  it("makes no copies when only the Default organization keeps it", async () => {
    const user = userEvent.setup();
    await toStep2(user);
    expect(screen.queryByRole("status")).toBeNull();
    await user.click(screen.getByRole("button", { name: "editor-save" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
    expect(h.copy).not.toHaveBeenCalled();
  });

  it("makes no copies when the step-2 save fails (C10)", async () => {
    const user = userEvent.setup();
    await toStep2(user, "share-three");
    h.saveTemplate.mockResolvedValue({ isSuccess: false, errors: { body: "bad" } });
    await user.click(screen.getByRole("button", { name: "editor-save" }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
    expect(h.copy).not.toHaveBeenCalled();
  });

  it("keeps the saved template and says so when copying can't start", async () => {
    const user = userEvent.setup();
    await toStep2(user, "share-three");
    h.copy.mockResolvedValue({
      isSuccess: false,
      errors: { Copy: "Copying couldn't start. Try again." },
    });
    await user.click(screen.getByRole("button", { name: "editor-save" }));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management/communications/tpl-1");
  });

  it("Change organizations returns to step 1 with the choice kept (Q4: A)", async () => {
    const user = userEvent.setup();
    await toStep2(user, "share-three");
    await user.click(screen.getByRole("button", { name: "Change organizations" }));
    expect(await screen.findByRole("button", { name: "submit-basic" })).toBeTruthy();
    expect(h.choice?.copy).toBe(true);
    expect(h.choice?.selected.size).toBe(3);
  });

  it("keeps Save & continue disabled while copying to selected organizations with none picked", async () => {
    const user = userEvent.setup();
    render(<NewCommunication />);
    await user.click(screen.getByRole("button", { name: "make-valid" }));
    await user.click(screen.getByRole("button", { name: "share-none" }));
    expect(screen.getByRole("button", { name: "Save & continue" })).toHaveProperty(
      "disabled",
      true,
    );
    await user.click(screen.getByRole("button", { name: "share-three" }));
    expect(screen.getByRole("button", { name: "Save & continue" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
