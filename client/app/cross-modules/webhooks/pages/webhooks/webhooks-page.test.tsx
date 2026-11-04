import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { http } from "@/lib/http/http-client";
import { makeWebhook } from "../../test-utils/__mocks__";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  setAddOpen: vi.fn(),
  addOpen: false,
}));

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => h.navigate,
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (path: string) => `/app/proj/${path}`,
}));
vi.mock("nuqs", () => ({
  parseAsBoolean: { withDefault: () => ({}) },
  useQueryState: () => [h.addOpen, h.setAddOpen],
}));
vi.mock("../../components/webhook-form-dialog", () => ({
  WebhookFormDialog: ({ open }: { open: boolean }) => (open ? <div>Add webhook form</div> : null),
}));

import { WebhooksPage } from "./webhooks-page";

const renderPage = () => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter>
        <WebhooksPage />
      </MemoryRouter>
    </Wrapper>,
  );
};

describe("WebhooksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.addOpen = false;
  });

  it("shows name, endpoint host and path, action count and status, never the query string", async () => {
    vi.mocked(http.get).mockResolvedValue([
      makeWebhook({ url: "https://crm.acme.com/hooks/blocks?token=abc" }),
    ]);
    renderPage();

    expect(await screen.findByText("CRM sync")).toBeTruthy();
    expect(screen.getByText("crm.acme.com/hooks/blocks")).toBeTruthy();
    expect(screen.getByText("3 actions")).toBeTruthy();
    expect(screen.getByText("iam.user.created, iam.user.updated +1")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.queryByText(/token=abc/)).toBeNull();
  });

  it("flags a failing webhook and one the system turned off", async () => {
    vi.mocked(http.get).mockResolvedValue([
      makeWebhook({ id: "a", name: "Failing", consecutiveFailures: 4 }),
      makeWebhook({
        id: "b",
        name: "Stopped",
        isActive: false,
        disabledReason: "too_many_failures",
      }),
    ]);
    renderPage();

    expect(await screen.findByText("4 failed")).toBeTruthy();
    expect(screen.getByText("Turned off after errors")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
  });

  it("opens the details of a webhook when its row is clicked", async () => {
    vi.mocked(http.get).mockResolvedValue([makeWebhook({ id: "wh 1" })]);
    renderPage();

    await userEvent.click(await screen.findByText("3 actions"));

    expect(h.navigate).toHaveBeenCalledWith("/app/proj/secret-management/webhooks/wh%201");
  });

  it("offers adding the first webhook when there are none", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Add webhook" }));

    expect(h.setAddOpen).toHaveBeenCalledWith(true);
  });

  it("shows the add form when the header button asked for it", async () => {
    h.addOpen = true;
    vi.mocked(http.get).mockResolvedValue([makeWebhook()]);
    renderPage();

    expect(await screen.findByText("Add webhook form")).toBeTruthy();
  });

  describe("paging", () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        makeWebhook({ id: `wh-${i + 1}`, name: `Hook ${String(i + 1).padStart(2, "0")}` }),
      );

    it("shows 10 webhooks per page and moves between pages", async () => {
      const user = userEvent.setup();
      vi.mocked(http.get).mockResolvedValue(many(23));
      renderPage();

      expect(await screen.findByText("Hook 01")).toBeTruthy();
      expect(screen.getByText("Hook 10")).toBeTruthy();
      expect(screen.queryByText("Hook 11")).toBeNull();
      expect(screen.getByText("Page 1 of 3")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Go to last page" }));

      expect(screen.getByText("Hook 21")).toBeTruthy();
      expect(screen.getByText("Hook 23")).toBeTruthy();
      expect(screen.queryByText("Hook 01")).toBeNull();
    });

    it("goes back to page 1 when the page size changes", async () => {
      const user = userEvent.setup();
      vi.mocked(http.get).mockResolvedValue(many(23));
      renderPage();
      await screen.findByText("Hook 01");
      await user.click(screen.getByRole("button", { name: "Go to next page" }));

      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: "25" }));

      expect(screen.getByText("Hook 01")).toBeTruthy();
      expect(screen.getByText("Hook 23")).toBeTruthy();
    });
  });
});
