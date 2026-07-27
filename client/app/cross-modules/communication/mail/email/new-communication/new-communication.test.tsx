import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  saveTemplate: vi.fn(),
  isPending: false,
  toast: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ mutateAsync: h.saveTemplate, isPending: h.isPending }),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({
  default: () => <nav data-testid="breadcrumb" />,
}));

// The basic-information child owns its own form; expose a button that fires the
// submit callback with a representative payload so the stepper flow is exercised.
vi.mock(
  "@blocks-communication/mail/components/email-service/basic-information/basic-information",
  () => ({
    default: ({
      onSubmit,
      onValidityChange,
      actions,
    }: {
      onSubmit: (data: { name: string }) => void;
      onValidityChange: (valid: boolean) => void;
      actions?: React.ReactNode;
    }) => (
      <div>
        <button type="button" onClick={() => onValidityChange(true)}>
          make-valid
        </button>
        <button type="button" onClick={() => onSubmit({ name: "Welcome" })}>
          submit-basic
        </button>
        {actions}
      </div>
    ),
  }),
);

// The bee plugin editor is a heavy iframe wrapper; expose a button that fires
// its save callback with the html/json payload.
vi.mock("@blocks-communication/mail/components/bee-plugin-starter/bee-plugin-starter", () => ({
  default: ({ onBeeSave }: { onBeeSave: (d: { htmlFile: string; jsonFile: string }) => void }) => (
    <button type="button" onClick={() => onBeeSave({ htmlFile: "<html/>", jsonFile: "{}" })}>
      bee-save
    </button>
  ),
}));

const { default: NewCommunication } = await import("./new-communication");

describe("NewCommunication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "tpl-1" });
  });

  it("keeps the basic-information Save disabled until the child reports validity", async () => {
    const user = userEvent.setup();
    render(<NewCommunication />);

    const save = screen.getByRole("button", { name: "Save & continue" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "make-valid" }));
    expect(save.disabled).toBe(false);
  });

  it("saves the basic information and advances to the template step", async () => {
    const user = userEvent.setup();
    render(<NewCommunication />);

    await user.click(screen.getByRole("button", { name: "submit-basic" }));

    await waitFor(() => expect(h.saveTemplate).toHaveBeenCalledTimes(1));
    expect(h.saveTemplate.mock.calls[0][0]).toMatchObject({
      name: "Welcome",
      projectKey: "tenant-1",
    });
    expect(await screen.findByRole("button", { name: "Save template" })).toBeTruthy();
  });

  it("saves the designed template and navigates to the new communication", async () => {
    const user = userEvent.setup();
    render(<NewCommunication />);

    await user.click(screen.getByRole("button", { name: "submit-basic" }));
    await screen.findByRole("button", { name: "bee-save" });

    h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "tpl-99" });
    await user.click(screen.getByRole("button", { name: "bee-save" }));

    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management/communications/tpl-99"),
    );
  });

  it("shows an error toast and returns to the list when the template save fails", async () => {
    const user = userEvent.setup();
    render(<NewCommunication />);

    await user.click(screen.getByRole("button", { name: "submit-basic" }));
    await screen.findByRole("button", { name: "bee-save" });

    h.saveTemplate.mockResolvedValue({ isSuccess: false, errors: { body: "bad" } });
    await user.click(screen.getByRole("button", { name: "bee-save" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", title: "Error" }),
      ),
    );
    expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management");
  });

  it("handles a thrown template save with a generic error toast", async () => {
    const user = userEvent.setup();
    render(<NewCommunication />);

    await user.click(screen.getByRole("button", { name: "submit-basic" }));
    await screen.findByRole("button", { name: "bee-save" });

    h.saveTemplate.mockRejectedValue(new Error("boom"));
    await user.click(screen.getByRole("button", { name: "bee-save" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Something went wrong" }),
      ),
    );
  });
});
