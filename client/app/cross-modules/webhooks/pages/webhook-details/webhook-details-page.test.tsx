import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

/** The value under a facts-strip label. */
const factValue = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

const openMoreActions = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByRole("button", { name: "More actions" }));

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
    expect(factValue("Failures in a row")).toBe("5");
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

    const panel = within(document.getElementById("delivery-dl-2") as HTMLElement);
    expect(panel.getByRole("columnheader", { name: "#" })).toBeTruthy();
    expect(panel.getByRole("cell", { name: "1" })).toBeTruthy();
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

    await openMoreActions(user);
    await user.click(await screen.findByRole("menuitem", { name: "Delete webhook" }));
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

    await openMoreActions(user);
    await user.click(await screen.findByRole("menuitem", { name: "Turn off" }));

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

describe("WebhookDetailsPage layout (#748)", () => {
  const failedWithTrace = (over: Partial<IWebhookDelivery> = {}) =>
    makeDelivery({
      id: "dl-9",
      eventId: "evt_09F",
      status: "Failed",
      statusReason: "HTTP_503",
      traceId: "7f3c1a9e42",
      attempts: [1, 2, 3].map((no) => ({
        no,
        at: "2026-11-02T10:00:01Z",
        httpStatus: 503,
        durationMs: 400,
        errorCode: "HTTP_503",
      })),
      ...over,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    deliveries = [makeDelivery()];
    serve();
  });

  it("names the page with one h1 and section h2s, and links back through the breadcrumb", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "CRM sync" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Actions it receives" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "History" })).toBeTruthy();

    const nav = within(screen.getByRole("navigation"));
    expect(nav.getByRole("link", { name: "Secrets & Configs" }).getAttribute("href")).toBe(
      "/app/proj/secret-management",
    );
    expect(nav.getByRole("link", { name: "Webhooks" }).getAttribute("href")).toBe(
      "/app/proj/secret-management/webhooks",
    );
    expect(nav.getByText("CRM sync").getAttribute("aria-current")).toBe("page");
  });

  it("offers an icon back button to the list for small screens", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "All webhooks" }));

    expect(h.navigate).toHaveBeenCalledWith("/app/proj/secret-management/webhooks");
  });

  it("shows the endpoint as a POST tag and the full URL, and copies the exact URL", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    const user = userEvent.setup();
    renderPage();

    const url = await screen.findByText("https://crm.acme.com/hooks/blocks");
    expect(url.getAttribute("title")).toBe("https://crm.acme.com/hooks/blocks");
    expect(screen.getByText("POST")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Copy endpoint URL" }));

    expect(await navigator.clipboard.readText()).toBe("https://crm.acme.com/hooks/blocks");
  });

  it("keeps Turn off and Delete in the menu of an active webhook", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("heading", { name: "CRM sync" });

    expect(screen.getByRole("button", { name: "Send test" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
    await openMoreActions(user);

    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(["Turn off", "Delete webhook"]);
  });

  it("shows Turn on beside Edit for an off webhook, with only Delete in the menu", async () => {
    const user = userEvent.setup();
    serve(makeWebhook({ isActive: false }));
    vi.mocked(http.post).mockResolvedValue(makeWebhook());
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Turn on" }));
    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(
        WEBHOOKS_ENDPOINTS.SAVE,
        expect.objectContaining({ id: "wh-1", isActive: true }),
      ),
    );
    await waitFor(() =>
      expect(h.showSuccessToast).toHaveBeenCalledWith({
        description: 'Webhook "CRM sync" is on.',
      }),
    );

    await openMoreActions(user);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Delete webhook",
    ]);
  });

  it("explains an automatic turn-off in a banner with the exact reason (E2)", async () => {
    serve(
      makeWebhook({
        isActive: false,
        disabledReason: "TOO_MANY_FAILURES",
        consecutiveFailures: 10,
      }),
    );
    renderPage();

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain(
      "Blocks stopped sending to this webhook after repeated failures.",
    );
    expect(banner.textContent).toContain(
      "Reason: TOO_MANY_FAILURES. Fix the endpoint, then turn it on.",
    );
    expect(within(banner).getByText("TOO_MANY_FAILURES").tagName).toBe("CODE");
    expect(screen.getByText("Off")).toBeTruthy();
    expect(screen.getByText("Turned off after errors")).toBeTruthy();
    expect(screen.queryByText("10 failed")).toBeNull();
    expect(screen.getByText("10").className).toContain("text-error");
  });

  it("shows no banner for a webhook a person turned off", async () => {
    serve(makeWebhook({ isActive: false }));
    renderPage();

    await screen.findByRole("button", { name: "Turn on" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows exactly three facts: the secret state, the created date only, and the failure number", async () => {
    serve(makeWebhook({ consecutiveFailures: 3 }));
    renderPage();
    await screen.findByRole("heading", { name: "CRM sync" });

    expect(factValue("Signing secret")).toMatch(/^Set · last changed .* · never shown$/);
    expect(screen.queryByText(/usr_admin_07/)).toBeNull();
    expect(factValue("Created")).not.toContain("by");
    expect(factValue("Failures in a row")).toBe("3");
    expect(screen.getByText("3 failed")).toBeTruthy();
    expect(screen.getByText("Failures in a row").nextElementSibling?.innerHTML).toContain(
      "text-error",
    );
  });

  it("does not colour zero failures as an error", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "CRM sync" });

    expect(factValue("Failures in a row")).toBe("0");
    expect(screen.getByText("Failures in a row").nextElementSibling?.innerHTML).not.toContain(
      "text-error",
    );
  });

  it("counts the actions and links to the Actions page", async () => {
    renderPage();
    const section = within(await screen.findByRole("region", { name: "Actions it receives" }));

    expect(
      section.getByRole("heading", { name: "Actions it receives" }).nextElementSibling?.textContent,
    ).toBe("3");
    expect(section.getByRole("link", { name: "Manage actions" }).getAttribute("href")).toBe(
      "/app/proj/secret-management/actions",
    );
  });

  it("puts the total count, the filters, the note and the pagination in the History card", async () => {
    renderPage();
    const history = within(await screen.findByRole("region", { name: "History" }));

    expect(await history.findByText("evt_01A")).toBeTruthy();
    expect(history.getByRole("heading", { name: "History" }).nextElementSibling?.textContent).toBe(
      "1",
    );
    expect(history.getByRole("combobox", { name: "Filter by action" })).toBeTruthy();
    expect(history.getByRole("combobox", { name: "Filter by status" })).toBeTruthy();
    expect(history.getByText(/Keeps the sent event/)).toBeTruthy();
  });

  it("opens and closes a row by clicking it, without another request", async () => {
    const user = userEvent.setup();
    deliveries = [failedWithTrace()];
    renderPage();

    const toggle = await screen.findByRole("button", { name: "Details evt_09F" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const requests = vi.mocked(http.get).mock.calls.length;

    await user.click(screen.getByText("evt_09F"));
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = within(document.getElementById("delivery-dl-9") as HTMLElement);
    for (const name of ["#", "Time", "Result", "Duration"]) {
      expect(panel.getByRole("columnheader", { name })).toBeTruthy();
    }
    expect(panel.getAllByText("HTTP 503")).toHaveLength(3);
    expect(panel.getAllByText("HTTP 503")[0].className).toContain("text-error");
    expect(panel.getByRole("button", { name: "Copy sent event" })).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("delivery-dl-9")).toBeNull();
    expect(vi.mocked(http.get).mock.calls.length).toBe(requests);
  });

  it("shows a delivered attempt's status in the success colour", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Details evt_01A" }));

    expect(screen.getByText("HTTP 200").className).toContain("text-success");
  });

  it("links an expanded delivery to its trace (H12)", async () => {
    const user = userEvent.setup();
    deliveries = [failedWithTrace({ traceId: "7f3c/1a9e42" })];
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Details evt_09F" }));

    expect(screen.getByRole("link", { name: "Open trace" }).getAttribute("href")).toBe(
      "/app/proj/lmt/tracing/7f3c%2F1a9e42",
    );
  });

  it.each([null, ""])("shows no trace link when the trace id is %j (C10)", async (traceId) => {
    const user = userEvent.setup();
    deliveries = [failedWithTrace({ traceId })];
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Details evt_09F" }));

    expect(screen.queryByRole("link", { name: "Open trace" })).toBeNull();
  });

  it("says when a delivery has no attempts yet and offers no Resend for it (C11)", async () => {
    const user = userEvent.setup();
    deliveries = [
      makeDelivery({ id: "dl-p", eventId: "evt_P", status: "Pending", attempts: [] }),
      makeDelivery({ id: "dl-s", eventId: "evt_S", status: "Skipped", attempts: [] }),
    ];
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Details evt_P" }));

    expect(screen.getByText("No attempts yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Resend/ })).toBeNull();
  });

  it("resends without toggling the row, and re-enables Resend afterwards (H13, C9)", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "DELIVERY_IN_FLIGHT" } });
    renderPage();

    const resend = await screen.findByRole("button", { name: "Resend evt_01A" });
    await user.click(resend);

    await waitFor(() => expect(h.showInfoToast).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "Details evt_01A" }).getAttribute("aria-expanded"),
    ).toBe("false");
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Resend evt_01A" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("offers Back to webhooks, not Retry, when the webhook does not exist (C1)", async () => {
    const user = userEvent.setup();
    vi.mocked(http.get).mockRejectedValue({ errors: { code: "WEBHOOK_NOT_FOUND" } });
    renderPage();

    expect(
      await screen.findByText(
        "It may have been deleted. Its history is kept, but the webhook can no longer be opened.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("navigation")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Back to webhooks" }));
    expect(h.navigate).toHaveBeenCalledWith("/app/proj/secret-management/webhooks");
  });

  it("offers Retry when the webhook could not be loaded (C2)", async () => {
    const user = userEvent.setup();
    vi.mocked(http.get).mockRejectedValue(new Error("network"));
    renderPage();

    expect(await screen.findByText("Could not load this webhook.")).toBeTruthy();
    expect(screen.getByText("Check your connection and try again.")).toBeTruthy();
    const calls = vi.mocked(http.get).mock.calls.length;

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(vi.mocked(http.get).mock.calls.length).toBeGreaterThan(calls));
  });

  it("shows skeletons in the page's shape while loading, with no spinner (C3)", async () => {
    vi.mocked(http.get).mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();

    expect(await screen.findByTestId("webhook-details-loading")).toBeTruthy();
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("keeps the History header and filters when the history fails, and retries (C12)", async () => {
    const user = userEvent.setup();
    vi.mocked(http.get).mockImplementation(async (url: string) => {
      if (url.startsWith(WEBHOOKS_ENDPOINTS.DELIVERIES)) throw new Error("boom");
      return makeWebhook();
    });
    renderPage();

    expect(await screen.findByText("Could not load the history.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filter by status" })).toBeTruthy();
    const before = deliveriesUrls().length;

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(deliveriesUrls().length).toBeGreaterThan(before));
  });

  it("says so inside the card when no event matches (C12)", async () => {
    deliveries = [];
    renderPage();

    expect(await screen.findByText("No events match.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Filter by action" })).toBeTruthy();
  });

  it("keeps the status and shows the save error when turning off fails (C8)", async () => {
    const user = userEvent.setup();
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "WEBHOOK_NAME_TAKEN" } });
    renderPage();

    await openMoreActions(user);
    await user.click(await screen.findByRole("menuitem", { name: "Turn off" }));

    await waitFor(() =>
      expect(h.showErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Could not save the webhook" }),
      ),
    );
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
  });

  it("keeps 50 expanded 8 KB bodies in capped scroll boxes with a single history request (C14)", async () => {
    const big = JSON.stringify({ data: "x".repeat(8 * 1024) });
    deliveries = Array.from({ length: 50 }, (_, index) =>
      makeDelivery({ id: `dl-${index}`, eventId: `evt_${index}`, body: big }),
    );
    renderPage();
    await screen.findByText("evt_49");

    for (const toggle of screen.getAllByRole("button", { name: /^Details evt_/ })) {
      // fireEvent: 50 sequential userEvent clicks are slow under a loaded full-suite run.
      fireEvent.click(toggle);
    }

    const bodies = document.querySelectorAll("pre");
    expect(bodies).toHaveLength(50);
    bodies.forEach((pre) => expect(pre.className).toContain("max-h-64"));
    expect(deliveriesUrls()).toHaveLength(1);
    // Rendering 50 expanded rows (50 attempts tables and 8 KB bodies) takes several seconds in
    // jsdom under coverage, so this boundary test gets more than the default 5 s.
  }, 30_000);
});
