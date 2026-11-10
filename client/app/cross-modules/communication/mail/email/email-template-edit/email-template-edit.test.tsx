import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  saveEmailTemplate: vi.fn(),
  isPending: false,
  navigate: vi.fn(),
  showErrorToast: vi.fn(),
  reset: vi.fn(),
  editorHtml: "<html/>",
  lastSave: undefined as unknown,
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplate: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
  useSaveEmailTemplate: () => ({ saveEmailTemplate: h.saveEmailTemplate, isPending: h.isPending }),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <nav /> }));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: h.showErrorToast }));
vi.mock("@blocks-communication/mail/components/mailcraft-editor/mailcraft-editor", () => {
  // Like the real editor, submit() calls onSave with the current HTML and ignores its promise;
  // the promise is kept so tests can check it never rejects.
  const MailcraftEditorMock = React.forwardRef(
    (
      props: { onSave: (d: { htmlFile: string }) => unknown; embedded?: boolean },
      ref: React.ForwardedRef<{ submit: () => void; reset: () => void }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        submit: () => {
          h.lastSave = props.onSave({ htmlFile: h.editorHtml });
        },
        reset: h.reset,
      }));
      return (
        <button
          data-embedded={props.embedded}
          data-testid="editor-save"
          onClick={() => {
            h.lastSave = props.onSave({ htmlFile: "<html/>" });
          }}
        >
          editor save
        </button>
      );
    },
  );
  MailcraftEditorMock.displayName = "MailcraftEditorMock";
  return { default: MailcraftEditorMock };
});

import { tStatic } from "@seliseblocks/genesis-os";
import { handleErrorMessages } from "@/lib/error";
import { templateErrorMessages } from "@blocks-communication/mail/constants/template-errors";
import { EditEmailTemplate } from "./email-template-edit";

const HTTP_REFUSAL =
  '"http://{{HostName}}" is not allowed: addresses in a mail template must start with https://.';
const TITLE = "Template not saved";
const GENERIC = "Could not save the template. Try again.";

/** The rejection the genesis-os HTTP client raises: an HttpError with `status` and `errors`. */
const httpError = (status: number, errors: unknown) =>
  Object.assign(new Error(JSON.stringify(errors)), { status, errors });

const saveFromPage = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Save/ }));
  await waitFor(() => expect(h.lastSave).toBeDefined());
  await h.lastSave;
};

/** The text lines the toast shows for the one showErrorToast call. */
const toastLines = () => {
  expect(h.showErrorToast).toHaveBeenCalledTimes(1);
  const { errors, customMessages } = h.showErrorToast.mock.calls[0][0];
  return [handleErrorMessages(errors, customMessages)].flat();
};

describe("EditEmailTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.isPending = false;
    h.data = { itemId: "t1", name: "Welcome Email", templateBody: "" };
    h.saveEmailTemplate.mockResolvedValue(undefined);
    h.editorHtml = "<html/>";
    h.lastSave = undefined;
  });

  it("renders the skeleton while the template loads", () => {
    h.isLoading = true;
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    expect(screen.queryByText("Welcome Email")).toBeNull();
    expect(screen.queryByTestId("editor-save")).toBeNull();
  });

  it("renders the template title, action buttons, and embedded editor", () => {
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    expect(screen.getByRole("heading", { name: "Welcome Email" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reset/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save/ })).toBeTruthy();
    expect(screen.getByTestId("editor-save").dataset.embedded).toBe("true");
  });

  it("saves the template through the editor callback and navigates back", async () => {
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    fireEvent.click(screen.getByTestId("editor-save"));
    await waitFor(() => expect(h.saveEmailTemplate).toHaveBeenCalled());
    expect(h.saveEmailTemplate.mock.calls[0][0]).toMatchObject({
      itemId: "t1",
      templateBody: "<html/>",
    });
    expect(h.navigate).toHaveBeenCalledWith("/app/proj/email-management/communications/t1");
  });

  describe("when the server refuses the save", () => {
    beforeEach(() => {
      h.editorHtml = '<a href="http://{{HostName}}">Open</a>';
      h.saveEmailTemplate.mockRejectedValueOnce(httpError(400, { TemplateBody: HTTP_REFUSAL }));
    });

    it("shows one error toast with the server's TemplateBody text (H2, §4)", async () => {
      render(<EditEmailTemplate params={{ id: "t1" }} />);
      await saveFromPage();
      expect(h.showErrorToast.mock.calls[0][0].title).toBe(TITLE);
      expect(toastLines()).toEqual([HTTP_REFUSAL]);
    });

    it("keeps the edits on the edit page with Save enabled (H3)", async () => {
      render(<EditEmailTemplate params={{ id: "t1" }} />);
      await saveFromPage();
      expect(h.saveEmailTemplate).toHaveBeenCalledTimes(1);
      expect(h.saveEmailTemplate.mock.calls[0][0].templateBody).toBe(h.editorHtml);
      expect(h.navigate).not.toHaveBeenCalled();
      expect(h.reset).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /Save/ }).hasAttribute("disabled")).toBe(false);
    });

    it("saves and navigates once the address is fixed to https (H1, H4)", async () => {
      render(<EditEmailTemplate params={{ id: "t1" }} />);
      await saveFromPage();
      h.editorHtml = '<a href="https://{{HostName}}">Open</a>';
      h.lastSave = undefined;
      await saveFromPage();
      expect(h.saveEmailTemplate).toHaveBeenCalledTimes(2);
      expect(h.saveEmailTemplate.mock.calls[1][0]).toMatchObject({
        itemId: "t1",
        templateBody: '<a href="https://{{HostName}}">Open</a>',
      });
      expect(h.navigate).toHaveBeenCalledTimes(1);
      expect(h.navigate).toHaveBeenCalledWith("/app/proj/email-management/communications/t1");
    });

    it("handles the rejection instead of leaving it unhandled (C1)", async () => {
      render(<EditEmailTemplate params={{ id: "t1" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Save/ }));
      await waitFor(() => expect(h.lastSave).toBeDefined());
      await expect(h.lastSave).resolves.toBeUndefined();
    });
  });

  it("shows each field's message on its own line, through the module's keys (§6)", async () => {
    h.saveEmailTemplate.mockRejectedValueOnce(
      httpError(400, { TemplateBody: HTTP_REFUSAL, TemplateSubject: "Subject is required." }),
    );
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    await saveFromPage();
    expect(h.showErrorToast.mock.calls[0][0].customMessages).toEqual(
      templateErrorMessages((key) => tStatic("os.communication.mail", key)),
    );
    expect(toastLines()).toEqual([HTTP_REFUSAL, "Subject is required."]);
  });

  it.each([
    ["a 400 without a field map", httpError(400, {})],
    ["a 400 whose messages are blank", httpError(400, { TemplateBody: " ", Other: [""] })],
    ["an error without a status", Object.assign(new Error("x"), { errors: { a: "b" } })],
    ["a plain Error", new Error("Unexpected token < in JSON")],
  ])("shows the generic message for %s (C2)", async (_case, error) => {
    h.saveEmailTemplate.mockRejectedValueOnce(error);
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    await saveFromPage();
    expect(h.showErrorToast).toHaveBeenCalledWith({ title: TITLE, errors: GENERIC });
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it.each([
    ["a network failure", httpError(500, { errors: new TypeError("Failed to fetch") })],
    ["a 503 with a field map", httpError(503, { general: "Service Unavailable" })],
  ])("shows the generic message for %s and does not navigate (C3, C4)", async (_case, error) => {
    h.saveEmailTemplate.mockRejectedValueOnce(error);
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    await saveFromPage();
    expect(h.showErrorToast).toHaveBeenCalledWith({ title: TITLE, errors: GENERIC });
    expect(h.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Save/ }).hasAttribute("disabled")).toBe(false);
  });

  it("shows a refusal message given as a list (§6)", async () => {
    h.saveEmailTemplate.mockRejectedValueOnce(httpError(400, { TemplateBody: [HTTP_REFUSAL] }));
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    await saveFromPage();
    expect(toastLines()).toEqual([HTTP_REFUSAL]);
  });
});
