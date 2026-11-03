import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@seliseblocks/genesis-os/lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailUsage, IMailBoxMailContent } from "@blocks-communication/mail/models/email";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";

const h = vi.hoisted(() => ({
  data: undefined as IEmailUsage | null | undefined,
  isLoading: false,
  getAttachmentFile: vi.fn(),
  getSource: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  ...mockProjectStoreFactory(),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-usage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@blocks-communication/mail/hooks/use-email-usage")>()),
  useGetEmailUsageById: () => ({ data: h.data, isLoading: h.isLoading }),
}));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-details-breadcrumb", () => ({
  EmailUsageDetailsBreadcrumb: () => <nav>breadcrumb</nav>,
}));
vi.mock("@blocks-communication/mail/services/email.services", () => ({
  emailService: {
    getMailBoxMailAttachmentFile: h.getAttachmentFile,
    getMailBoxMailSource: h.getSource,
  },
}));
vi.mock("@/hooks/use-toast", () => ({ toast: h.toast }));
vi.mock("@blocks-communication/mail/email/email-usage/email-usage-details-skeleton", () => ({
  EmailUsageDetailsSkeleton: () => <div>skeleton</div>,
}));

import { EmailUsageDetails } from "./email-usage-details";

const RAW = "Subject: inbound test 1\r\n\r\nTest Inbound";
const SOURCE_FAILED = "The original message could not be loaded. Try again later.";
const TOO_LARGE = "This message is too large to preview — download .eml";

const content = (over: Partial<IMailBoxMailContent> = {}): IMailBoxMailContent => ({
  htmlBody: null,
  textBody: "Test Inbound",
  cc: null,
  replyTo: null,
  attachments: [],
  rawMimeLength: RAW.length,
  previewTooLarge: false,
  ...over,
});

const mail = (over: Partial<IEmailUsage> = {}): IEmailUsage =>
  ({
    messageId: "m-1",
    from: '"Abdullah Al Momen" <momen@gmail.com>',
    to: "support@amlora.ch",
    subject: "inbound test 1",
    body: "Test Inbound",
    status: "Received",
    error: "",
    date: "2026-09-23T13:25:49Z",
    isInbound: true,
    rawMime: null,
    content: content(),
    ...over,
  }) as IEmailUsage;

const blobOf = (...parts: BlobPart[]) => new Blob(parts, { type: "application/octet-stream" });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// The library default (retry 3) rather than the test wrapper's retry: false, so the source
// query's own `retry: false` is what keeps a failure to one request.
const renderDetails = (id = "row-1") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailUsageDetails id={id} />
    </QueryClientProvider>,
  );

const sourceToast = () =>
  expect(h.toast).toHaveBeenCalledWith({
    variant: "destructive",
    title: "Download failed",
    description: SOURCE_FAILED,
  });

describe("EmailUsageDetails", () => {
  let saved: { blob: Blob; fileName: string }[];
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.data = mail();
    saved = [];
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
    let lastBlob: Blob | undefined;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        lastBlob = blob;
        return "blob:x";
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push({ blob: lastBlob as Blob, fileName: this.download });
    });
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
    vi.restoreAllMocks();
  });

  it("shows the subject, sender and recipient", () => {
    renderDetails();
    expect(screen.getByRole("heading", { name: "inbound test 1" })).toBeTruthy();
    expect(screen.getByText("Abdullah Al Momen")).toBeTruthy();
    expect(screen.getByText("<momen@gmail.com>")).toBeTruthy();
    expect(screen.getByText("support@amlora.ch")).toBeTruthy();
    // An inbound mail's status is implied.
    expect(screen.queryByText("Received")).toBeNull();
  });

  it("renders the HTML body in a frame that cannot run scripts", () => {
    h.data = mail({ content: content({ htmlBody: "<div>Test <b>Inbound</b></div>" }) });
    renderDetails();

    const frame = screen.getByTitle("Email body") as HTMLIFrameElement;
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).not.toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("<b>Inbound</b>");
  });

  describe("Original view (H9)", () => {
    it("requests the source only when Original is opened, shows a spinner, then the text", async () => {
      const pending = deferred<Blob>();
      h.getSource.mockReturnValue(pending.promise);
      const { container } = renderDetails();
      expect(screen.getByText("Test Inbound")).toBeTruthy();
      expect(h.getSource).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("tab", { name: "Original" }));
      expect(h.getSource).toHaveBeenCalledTimes(1);
      expect(h.getSource).toHaveBeenCalledWith("row-1");
      expect(container.querySelector(".animate-spin")).toBeTruthy();

      await act(async () => pending.resolve(blobOf(RAW)));
      await waitFor(() => expect(screen.getByText(/Subject: inbound test 1/)).toBeTruthy());
      expect(container.querySelector(".animate-spin")).toBeNull();

      // Back and forth does not fetch it again.
      await userEvent.click(screen.getByRole("tab", { name: "Plain text" }));
      await userEvent.click(screen.getByRole("tab", { name: "Original" }));
      expect(screen.getByText(/Subject: inbound test 1/)).toBeTruthy();
      expect(h.getSource).toHaveBeenCalledTimes(1);
      expect(h.toast).not.toHaveBeenCalled();
    });

    it("maps every byte to the character with the same code (0x80 -> U+0080)", async () => {
      h.getSource.mockResolvedValue(blobOf(new Uint8Array([0x41, 0x80, 0x9f, 0xe9, 0x42])));
      const { container } = renderDetails();
      await userEvent.click(screen.getByRole("tab", { name: "Original" }));

      await waitFor(() => expect(container.querySelector("pre.font-mono")).toBeTruthy());
      expect(container.querySelector("pre.font-mono")?.textContent).toBe("A\u0080\u009féB");
    });

    it("decodes a source larger than one 32,768-byte chunk in order", async () => {
      const bytes = new Uint8Array(70_000).map((_, i) => 0x41 + (i % 26));
      h.getSource.mockResolvedValue(blobOf(bytes));
      const { container } = renderDetails();
      await userEvent.click(screen.getByRole("tab", { name: "Original" }));

      await waitFor(() => expect(container.querySelector("pre.font-mono")).toBeTruthy());
      const text = container.querySelector("pre.font-mono")?.textContent ?? "";
      expect(text).toHaveLength(70_000);
      expect(text.slice(32_766, 32_770)).toBe(String.fromCharCode(...bytes.slice(32_766, 32_770)));
    });

    it("opens Original by default and loads it when it is the only view (Q1-A)", async () => {
      h.data = mail({ body: "\n", content: content({ textBody: null }) });
      h.getSource.mockResolvedValue(blobOf(RAW));
      renderDetails();

      expect(screen.queryByRole("tab")).toBeNull();
      await waitFor(() => expect(screen.getByText(/Subject: inbound test 1/)).toBeTruthy());
      expect(h.getSource).toHaveBeenCalledTimes(1);
    });
  });

  describe("Download .eml (H10)", () => {
    it("saves a message/rfc822 file named after the subject", async () => {
      h.data = mail({ subject: 'Re: a/b "c"' });
      h.getSource.mockResolvedValue(blobOf(RAW));
      renderDetails();

      await userEvent.click(screen.getByRole("button", { name: "Download .eml" }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].fileName).toBe("Re_ a_b _c_.eml");
      expect(saved[0].blob.type).toBe("message/rfc822");
      expect(new TextDecoder().decode(await saved[0].blob.arrayBuffer())).toBe(RAW);
      expect(h.getSource).toHaveBeenCalledTimes(1);
      expect(h.toast).not.toHaveBeenCalled();
    });

    it("reuses a source the Original view already loaded", async () => {
      h.getSource.mockResolvedValue(blobOf(RAW));
      renderDetails();
      await userEvent.click(screen.getByRole("tab", { name: "Original" }));
      await waitFor(() => expect(screen.getByText(/Subject: inbound test 1/)).toBeTruthy());

      await userEvent.click(screen.getByRole("button", { name: "Download .eml" }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].fileName).toBe("inbound test 1.eml");
      expect(h.getSource).toHaveBeenCalledTimes(1);
    });

    it("shows a spinner and is disabled while the source loads", async () => {
      const pending = deferred<Blob>();
      h.getSource.mockReturnValue(pending.promise);
      renderDetails();
      const button = screen.getByRole("button", { name: "Download .eml" });

      await userEvent.click(button);
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(button.querySelector(".animate-spin")).toBeTruthy();

      await act(async () => pending.resolve(blobOf(RAW)));
      await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
      expect(button.querySelector(".animate-spin")).toBeNull();
      expect(saved).toHaveLength(1);
    });

    it("is not offered for outbound mail, which has no stored source", () => {
      h.data = mail({ isInbound: false, status: "Delivered", content: null });
      renderDetails();
      expect(screen.queryByRole("button", { name: "Download .eml" })).toBeNull();
      expect(screen.queryByRole("tab", { name: "Original" })).toBeNull();
      expect(screen.getByText("Test Inbound")).toBeTruthy();
    });
  });

  describe("attachments (H11)", () => {
    it("lists attachments", () => {
      h.data = mail({
        content: content({
          textBody: "see attached",
          attachments: [{ fileName: "invoice.pdf", contentType: "application/pdf", size: 2048 }],
        }),
      });
      renderDetails();
      expect(screen.getByText("1 attachment")).toBeTruthy();
      expect(screen.getByText("invoice.pdf")).toBeTruthy();
    });

    it("downloads a file by the route id and position, typed and named from the details", async () => {
      h.data = mail({
        content: content({
          textBody: "see attached",
          attachments: [
            { fileName: "notes.txt", contentType: "text/plain", size: 1 },
            { fileName: "invoice.pdf", contentType: "application/pdf", size: 3 },
          ],
        }),
      });
      h.getAttachmentFile.mockResolvedValue(blobOf("pdf"));
      renderDetails("row-1");

      await userEvent.click(screen.getByRole("button", { name: "Download invoice.pdf" }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(h.getAttachmentFile).toHaveBeenCalledWith("row-1", 1);
      expect(saved[0].fileName).toBe("invoice.pdf");
      expect(saved[0].blob.type).toBe("application/pdf");
      expect(await saved[0].blob.text()).toBe("pdf");
      expect(h.getSource).not.toHaveBeenCalled();
      expect(h.toast).not.toHaveBeenCalled();
    });

    it("falls back to application/octet-stream when the type is unknown", async () => {
      h.data = mail({
        content: content({ attachments: [{ fileName: "blob.bin", contentType: "" }] }),
      });
      h.getAttachmentFile.mockResolvedValue(blobOf("x"));
      renderDetails();

      await userEvent.click(screen.getByRole("button", { name: "Download blob.bin" }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].blob.type).toBe("application/octet-stream");
    });
  });

  describe("too large to preview (H12)", () => {
    it("shows the notice and the .eml, without tabs, frame or attachment chips", async () => {
      h.data = mail({
        body: "<p>stored body</p>",
        content: content({
          htmlBody: null,
          textBody: null,
          attachments: [{ fileName: "invoice.pdf", contentType: "application/pdf" }],
          rawMimeLength: 8_388_609,
          previewTooLarge: true,
        }),
      });
      h.getSource.mockResolvedValue(blobOf(RAW));
      renderDetails();

      expect(screen.getByRole("heading", { name: "inbound test 1" })).toBeTruthy();
      const notice = screen.getByText(TOO_LARGE);
      expect(notice.className).toBe("p-5 text-sm italic text-muted-foreground");
      expect(screen.queryByRole("tab")).toBeNull();
      expect(screen.queryByTitle("Email body")).toBeNull();
      expect(screen.queryByText("invoice.pdf")).toBeNull();
      expect(screen.queryByText("stored body")).toBeNull();
      expect(screen.queryByText("This message has no body.")).toBeNull();
      expect(h.getSource).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole("button", { name: "Download .eml" }));
      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0].blob.type).toBe("message/rfc822");
    });
  });

  it("falls back to the stored body when the message could not be parsed (C5)", async () => {
    h.data = mail({ body: "stored body", content: content({ textBody: null, htmlBody: null }) });
    h.getSource.mockResolvedValue(blobOf(RAW));
    renderDetails();

    expect(screen.getByText("stored body")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download .eml" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Original" }));
    await waitFor(() => expect(screen.getByText(/Subject: inbound test 1/)).toBeTruthy());
  });

  describe("failures (C10)", () => {
    const failures: [string, () => Promise<never>][] = [
      [
        "a 404",
        () => Promise.reject(new HttpError(404, { errors: { MessageId: "Mail not found" } })),
      ],
      ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
      ["a non-file answer", () => Promise.reject(new Error("Unexpected message source response"))],
    ];

    it.each(failures)(
      "shows the toast and the panel text once on %s in Original",
      async (_, fail) => {
        h.getSource.mockImplementation(fail);
        renderDetails();
        await userEvent.click(screen.getByRole("tab", { name: "Original" }));

        const panel = await screen.findByText(SOURCE_FAILED);
        expect(panel.className).toBe("p-5 text-sm italic text-muted-foreground");
        sourceToast();
        expect(h.toast).toHaveBeenCalledTimes(1);
        expect(h.getSource).toHaveBeenCalledTimes(1);

        // The page stays usable.
        await userEvent.click(screen.getByRole("tab", { name: "Plain text" }));
        expect(screen.getByText("Test Inbound")).toBeTruthy();
        expect(h.toast).toHaveBeenCalledTimes(1);
        expect(unhandled).toEqual([]);
      },
    );

    it.each(failures)("shows the toast on %s from Download .eml", async (_, fail) => {
      h.getSource.mockImplementation(fail);
      renderDetails();
      const button = screen.getByRole("button", { name: "Download .eml" });

      await userEvent.click(button);

      await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));
      sourceToast();
      expect(h.getSource).toHaveBeenCalledTimes(1);
      expect(saved).toHaveLength(0);
      await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
      expect(unhandled).toEqual([]);
    });

    it("toasts once when .eml joins a failing Original request", async () => {
      const pending = deferred<Blob>();
      h.getSource.mockReturnValue(pending.promise);
      renderDetails();
      await userEvent.click(screen.getByRole("tab", { name: "Original" }));
      await userEvent.click(screen.getByRole("button", { name: "Download .eml" }));

      await act(async () => pending.reject(new HttpError(404, { errors: {} })));

      await screen.findByText(SOURCE_FAILED);
      expect(h.getSource).toHaveBeenCalledTimes(1);
      expect(h.toast).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
    });

    it("toasts again for a second failed attempt", async () => {
      h.getSource.mockRejectedValue(new HttpError(500, { errors: {} }));
      renderDetails();
      const button = screen.getByRole("button", { name: "Download .eml" });

      await userEvent.click(button);
      await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));
      await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
      await userEvent.click(button);

      await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(2));
      expect(h.getSource).toHaveBeenCalledTimes(2);
    });

    it.each(failures)("shows the attachment toast with its name on %s", async (_, fail) => {
      h.data = mail({
        content: content({
          attachments: [{ fileName: "invoice.pdf", contentType: "application/pdf" }],
        }),
      });
      h.getAttachmentFile.mockImplementation(fail);
      renderDetails();
      const chip = screen.getByRole("button", { name: "Download invoice.pdf" });

      await userEvent.click(chip);

      await waitFor(() =>
        expect(h.toast).toHaveBeenCalledWith({
          variant: "destructive",
          title: "Download failed",
          description: "invoice.pdf could not be downloaded. Try again, or download the .eml.",
        }),
      );
      expect(h.getAttachmentFile).toHaveBeenCalledTimes(1);
      await waitFor(() => expect((chip as HTMLButtonElement).disabled).toBe(false));
      expect(saved).toHaveLength(0);
      expect(unhandled).toEqual([]);
    });
  });

  it("hides the plain-text view when the body is only whitespace", () => {
    h.data = mail({
      body: "\n",
      content: content({ htmlBody: "<div><br></div>", textBody: null }),
    });
    renderDetails();
    expect(screen.queryByRole("tab", { name: "Plain text" })).toBeNull();
  });

  it("announces a failure for the next message after the route id changes", async () => {
    h.getSource.mockRejectedValue(new HttpError(404, { errors: {} }));
    const client = new QueryClient();
    const view = (id: string) => (
      <QueryClientProvider client={client}>
        <EmailUsageDetails id={id} />
      </QueryClientProvider>
    );
    const { rerender } = render(view("row-1"));
    await userEvent.click(screen.getByRole("tab", { name: "Original" }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(1));

    rerender(view("row-2"));

    await waitFor(() => expect(h.getSource).toHaveBeenCalledWith("row-2"));
    await waitFor(() => expect(h.toast).toHaveBeenCalledTimes(2));
    expect(h.getSource).toHaveBeenCalledTimes(2);
  });

  it("shows a not-found state", () => {
    h.data = null;
    renderDetails("missing");
    expect(screen.getByText("Email details not found.")).toBeTruthy();
  });
});
