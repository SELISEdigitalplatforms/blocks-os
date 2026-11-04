import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { http } from "@/lib/http/http-client";
import { ACTIONS_ENDPOINTS } from "../../constants/endpoint.constant";
import { makeAction, sampleActions } from "../../test-utils/__mocks__";

const toasts = vi.hoisted(() => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  showInfoToast: vi.fn(),
}));

vi.mock("@/lib/http/http-client", () => mockHttpClientFactory());
vi.mock("@/hooks/use-toast", () => toasts);

import { ActionsPage } from "./actions-page";

const USER_CREATED_NAME = "iam.user.created";
const USER_CREATED = "User created";
const WORKFLOW = "Workflow";
const NEXT_PAGE = "Go to next page";
const FIRST_EVENT = "User event 01";
const ELEVENTH_EVENT = "User event 11";
const ARIA_CHECKED = "aria-checked";
const CHECKED = "true";
const UNCHECKED = "false";

const renderPage = () => render(<ActionsPage />, { wrapper: createWrapper() });

const switchOf = (label: string, target: string) =>
  screen.getByRole("switch", { name: `${label} - ${target}` });

describe("ActionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.get).mockResolvedValue(sampleActions);
    vi.mocked(http.post).mockResolvedValue(true);
  });

  it("groups IAM actions into Users and Organizations next to the other services", async () => {
    renderPage();

    expect(await screen.findByRole("heading", { name: "Users" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Organizations" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Localization" })).toBeTruthy();
    expect(screen.getByText(USER_CREATED_NAME)).toBeTruthy();
  });

  it("shows the empty state when the actions are not seeded", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("No actions set up yet")).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(http.get).mockRejectedValueOnce(new Error("offline"));
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Users" })).toBeTruthy();
  });

  it("opens the JSON example under the action and closes it again", async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = await screen.findByRole("button", { name: "User created - Payload" });

    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe(CHECKED);
    const code = screen.getByText(/"action": "iam.user.created"/);
    expect(code.textContent).toContain('"organizationId": "org_41c"');
    expect(code.textContent).toContain('"mfaEnabled": true');

    await user.click(toggle);
    expect(screen.queryByText(/"action": "iam.user.created"/)).toBeNull();
  });

  it("turns a target on at once without asking", async () => {
    const user = userEvent.setup();
    // Like the real server: after the update, the list comes back with the flag on.
    vi.mocked(http.post).mockImplementation(async () => {
      vi.mocked(http.get).mockResolvedValue([makeAction({ workflow: true })]);
      return true;
    });
    vi.mocked(http.get).mockResolvedValue([makeAction()]);
    renderPage();

    await user.click(await screen.findByRole("switch", { name: "User created - Workflow" }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(ACTIONS_ENDPOINTS.UPDATE, {
        name: USER_CREATED_NAME,
        target: "workflow",
        enabled: true,
      }),
    );
    await waitFor(() =>
      expect(switchOf(USER_CREATED, WORKFLOW).getAttribute(ARIA_CHECKED)).toBe(CHECKED),
    );
    expect(toasts.showSuccessToast).toHaveBeenCalled();
  });

  it("shows the new state before the server answers and locks that switch meanwhile", async () => {
    const user = userEvent.setup();
    let answer: (value: boolean) => void = () => {};
    vi.mocked(http.post).mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    vi.mocked(http.get).mockResolvedValue([makeAction()]);
    renderPage();

    await user.click(await screen.findByRole("switch", { name: "User created - Workflow" }));

    const toggle = switchOf(USER_CREATED, WORKFLOW);
    await waitFor(() => expect(toggle.getAttribute(ARIA_CHECKED)).toBe(CHECKED));
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    answer(true);
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
  });

  it("asks before turning a target off and sends nothing on cancel", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("switch", { name: "User created - Webhook" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Turn this off?")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(http.post).not.toHaveBeenCalled();
    expect(switchOf(USER_CREATED, "Webhook").getAttribute(ARIA_CHECKED)).toBe(CHECKED);
  });

  it("turns a target off after the confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("switch", { name: "User created - Webhook" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Turn off" }),
    );

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith(ACTIONS_ENDPOINTS.UPDATE, {
        name: USER_CREATED_NAME,
        target: "webhook",
        enabled: false,
      }),
    );
  });

  it("puts the switch back and explains when the server refuses", async () => {
    const user = userEvent.setup();
    vi.mocked(http.get).mockResolvedValue([makeAction()]);
    vi.mocked(http.post).mockRejectedValue({ errors: { code: "ACTION_NOT_FOUND" } });
    renderPage();

    await user.click(await screen.findByRole("switch", { name: "User created - Function" }));

    await waitFor(() => expect(toasts.showErrorToast).toHaveBeenCalled());
    const call = toasts.showErrorToast.mock.calls[0][0];
    expect(call.errors).toEqual({ code: "ACTION_NOT_FOUND" });
    expect(call.customMessages.ACTION_NOT_FOUND).toBe(
      "This action no longer exists. Reload the page.",
    );
    await waitFor(() =>
      expect(switchOf(USER_CREATED, "Function").getAttribute(ARIA_CHECKED)).toBe(UNCHECKED),
    );
  });

  describe("paging", () => {
    const manyUserActions = Array.from({ length: 12 }, (_, i) =>
      makeAction({
        name: `iam.user.event${String(i + 1).padStart(2, "0")}`,
        label: `User event ${String(i + 1).padStart(2, "0")}`,
      }),
    );

    it("shows 10 actions per group and moves to the next page", async () => {
      const user = userEvent.setup();
      vi.mocked(http.get).mockResolvedValue(manyUserActions);
      renderPage();

      expect(await screen.findByText(FIRST_EVENT)).toBeTruthy();
      expect(screen.getByText("User event 10")).toBeTruthy();
      expect(screen.queryByText(ELEVENTH_EVENT)).toBeNull();
      expect(screen.getByText("Page 1 of 2")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: NEXT_PAGE }));

      expect(screen.getByText(ELEVENTH_EVENT)).toBeTruthy();
      expect(screen.queryByText(FIRST_EVENT)).toBeNull();
      expect(switchOf("User event 12", WORKFLOW).getAttribute(ARIA_CHECKED)).toBe(UNCHECKED);
    });

    it("keeps the payload row under its own action and switches work on page 2", async () => {
      const user = userEvent.setup();
      vi.mocked(http.get).mockResolvedValue(manyUserActions);
      renderPage();
      await screen.findByText(FIRST_EVENT);
      await user.click(screen.getByRole("button", { name: NEXT_PAGE }));

      await user.click(screen.getByRole("button", { name: "User event 11 - Payload" }));
      const code = screen.getByText(/"action": "iam.user.event11"/);
      const rows = screen.getAllByRole("row");
      const ownRow = rows.findIndex((row) => within(row).queryByText("iam.user.event11"));
      expect(rows[ownRow + 1].contains(code)).toBe(true);

      await user.click(switchOf(ELEVENTH_EVENT, WORKFLOW));
      await waitFor(() => expect(http.post).toHaveBeenCalled());
    });

    it("goes back to page 1 when the page size changes", async () => {
      const user = userEvent.setup();
      vi.mocked(http.get).mockResolvedValue(manyUserActions);
      renderPage();
      await screen.findByText(FIRST_EVENT);
      await user.click(screen.getByRole("button", { name: NEXT_PAGE }));

      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByRole("option", { name: "25" }));

      expect(screen.getByText(FIRST_EVENT)).toBeTruthy();
      expect(screen.getByText("User event 12")).toBeTruthy();
    });
  });
});
