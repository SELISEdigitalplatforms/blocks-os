import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { http } from "@/lib/http/http-client";
import { WEBHOOKS_ENDPOINTS } from "../../constants/endpoint.constant";
import type { IWebhookDelivery } from "../../models/webhook.model";
import { makeDelivery, makeWebhook } from "../../test-utils/__mocks__";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  showInfoToast: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (path: string) => `/app/proj/${path}`,
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: h.showSuccessToast,
  showErrorToast: h.showErrorToast,
  showInfoToast: h.showInfoToast,
}));
vi.mock("../../components/webhook-form-dialog", () => ({
  WebhookFormDialog: ({ open }: { open: boolean }) => (open ? <div>Edit webhook form</div> : null),
}));

import { WebhookDetailsPage } from "./webhook-details-page";

const RESEND_FIRST = "Resend evt_01A";

let deliveries: IWebhookDelivery[] = [];

const serve = (webhook = makeWebhook()) => {
  vi.mocked(http.get).mockImplementation(async (url: string) => {
    if (url.startsWith(WEBHOOKS_ENDPOINTS.DELIVERIES)) {
      return { totalCount: deliveries.length, items: deliveries };
    }
    return webhook;
  });
};

const deliveriesUrls = () =>
  vi
    .mocked(http.get)
    .mock.calls.map(([url]) => String(url))
    .filter((url) => url.startsWith(WEBHOOKS_ENDPOINTS.DELIVERIES));

const renderPage = () => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter initialEntries={["/webhooks/wh-1"]}>
        <Routes>
          <Route path="/webhooks/:id" element={<WebhookDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </Wrapper>,
  );
};

describe("WebhookDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deliveries = [
      makeDelivery(),
      makeDelivery({
        id: "dl-2",
        eventId: "evt_02B",
        status: "Failed",
        statusReason: "http_error",
      }),
      makeDelivery({ id: "dl-3", eventId: "evt_03C", status: "Retrying" }),
    ];
    serve();
  });

  it("shows the webhook, its secret state without any secret, and the actions it receives", async () => {
    serve(
      makeWebhook({ isActive: false, disabledReason: "too_many_failures", consecutiveFailures: 5 }),
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: "CRM sync" })).toBeTruthy();
    expect(screen.getByText("https://crm.acme.com/hooks/blocks")).toBeTruthy();
    expect(screen.getByText(/Set · last changed .* · never shown/)).toBeTruthy();
    expect(screen.getByText("too_many_failures")).toBeTruthy();
    expect(screen.getByText("5 in a row")).toBeTruthy();
    expect(screen.getByText("iam.user.activated")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Turn on" })).toBeTruthy();
  });

  it("says so when the webhook does not exist", async () => {
    vi.mocked(http.get).mockRejectedValue({ errors: { code: "WEBHOOK_NOT_FOUND" } });
    renderPage();

    expect(await screen.findByText("This webhook does not exist.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("sends the status filter to the server and starts again from page 1", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("evt_01A");

    await user.click(screen.getByRole("combobox", { name: "Filter by status" }));
    await user.click(await screen.findByRole("option", { name: "Failed" }));

    await waitFor(() => expect(deliveriesUrls().at(-1)).toContain("status=Failed"));
    expect(deliveriesUrls().at(-1)).toContain("page=1");
    expect(deliveriesUrls().at(-1)).toContain("webhookId=wh-1");
  });

  it("filters by one of the webhook's actions", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("evt_01A");

    await user.click(screen.getByRole("combobox", { name: "Filter by action" }));
    await user.click(await screen.findByRole("option", { name: "iam.user.updated" }));

    await waitFor(() => expect(deliveriesUrls().at(-1)).toContain("action=iam.user.updated"));
  });

  it("shows the reason of a failed event and opens attempts next to the sent body", async () => {
    const user = userEvent.setup();
    deliveries = [
      makeDelivery({
        id: "dl-2",
        eventId: "evt_02B",
        status: "Failed",
        statusReason: "http_error",
        attempts: [
          {
            no: 1,
            at: "2026-11-02T10:00:01Z",
            httpStatus: 500,
            durationMs: 80,
            errorCode: "http_error",
          },
          {
            no: 2,
            at: "2026-11-02T10:05:01Z",
            httpStatus: null,
            durationMs: 10000,
            errorCode: "timeout",
          },
        ],
      }),
    ];
    renderPage();

    expect(await screen.findByText("http_error")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Details evt_02B" }));

    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("HTTP 500")).toBeTruthy();
    expect(screen.getByText("timeout")).toBeTruthy();
    expect(screen.getByText(/"userId": "u1"/)).toBeTruthy();
  });

  it("offers Resend only for delivered and failed events", async () => {
    renderPage();
    await screen.findByText("evt_03C");

    expect(screen.getByRole("button", { name: RESEND_FIRST })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend evt_02B" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resend evt_03C" })).toBeNull();
  });

  it("resends an event and tells the user", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockResolvedValue(true);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Resend evt_02B" }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(WEBHOOKS_ENDPOINTS.RESEND, { deliveryId: "dl-2" }),
    );
    await waitFor(() => expect(h.showSuccessToast).toHaveBeenCalled());
  });

  it("explains, without an error, that an event is still being sent (409)", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "DELIVERY_IN_FLIGHT" } });
    renderPage();

    await user.click(await screen.findByRole("button", { name: RESEND_FIRST }));

    await waitFor(() =>
      expect(h.showInfoToast).toHaveBeenCalledWith({
        description: "This event is being sent right now. Try again in a moment.",
      }),
    );
    expect(h.showErrorToast).not.toHaveBeenCalled();
  });

  it("maps a refused resend to a clear message", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "WEBHOOK_INACTIVE" } });
    renderPage();

    await user.click(await screen.findByRole("button", { name: RESEND_FIRST }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
    const { errors, customMessages } = h.showErrorToast.mock.calls[0][0];
    expect(customMessages[errors.code]).toBe("This webhook is off. Turn it on to resend.");
  });

  it("shows the HTTP status and time of a test send", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockResolvedValue({
      delivered: true,
      httpStatus: 204,
      durationMs: 87,
      errorCode: null,
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Send test" }));

    await waitFor(() =>
      expect(h.showSuccessToast).toHaveBeenCalledWith({
        title: "Test sent",
        description: "HTTP 204 in 87 ms",
      }),
    );
  });

  it("reports a failed test send with its error code", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockResolvedValue({
      delivered: false,
      httpStatus: null,
      durationMs: 10000,
      errorCode: "timeout",
    });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Send test" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith({
        title: "Test failed",
        errors: "- in 10000 ms timeout",
      }),
    );
  });

  it("deletes only after the confirmation, then returns to the list", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockResolvedValue(true);
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(http.post).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(WEBHOOKS_ENDPOINTS.DELETE, { id: "wh-1" }),
    );
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith("/app/proj/secret-management/webhooks"),
    );
  });

  it("turns the webhook off with the same settings, leaving the secret alone", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockResolvedValue(makeWebhook({ isActive: false }));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Turn off" }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(WEBHOOKS_ENDPOINTS.SAVE, {
        id: "wh-1",
        name: "CRM sync",
        url: "https://crm.acme.com/hooks/blocks",
        isActive: false,
        actions: ["iam.user.created", "iam.user.updated", "iam.user.activated"],
      }),
    );
  });
});
