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
const SEARCH_PLACEHOLDER = "Search actions";
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

  it("has a search box and no intro text", async () => {
    renderPage();

    expect(await screen.findByPlaceholderText(SEARCH_PLACEHOLDER)).toBeTruthy();
    expect(screen.queryByText(/Choose what can run/)).toBeNull();
  });

  it("shows only matching actions and hides groups with no match", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByPlaceholderText(SEARCH_PLACEHOLDER), "GENERATION");

    expect(await screen.findByRole("heading", { name: "Localization" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Users" })).toBeNull());
    expect(screen.queryByRole("heading", { name: "Organizations" })).toBeNull();
    expect(screen.queryByText(USER_CREATED_NAME)).toBeNull();
    expect(screen.getByText("localization.files.generated")).toBeTruthy();
  });

  it("shows a no-match text, not the empty state, and all rows again when cleared", async () => {
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByPlaceholderText(SEARCH_PLACEHOLDER);

    await user.type(input, "zzz");
    expect(await screen.findByText("No actions match your search.")).toBeTruthy();
    expect(screen.queryByText("No actions set up yet")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Users" })).toBeNull();

    await user.clear(input);
    expect(await screen.findByRole("heading", { name: "Users" })).toBeTruthy();
    expect(screen.queryByText("No actions match your search.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Localization" })).toBeTruthy();
  });

  it("keeps the payload rows working while the list is filtered", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByPlaceholderText(SEARCH_PLACEHOLDER), "mfaenabled");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Localization" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "User created - Payload" }));

    expect(screen.getByText(/"action": "iam.user.created"/)).toBeTruthy();
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
});
