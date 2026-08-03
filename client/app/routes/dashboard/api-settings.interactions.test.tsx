import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IApiEndpoint } from "@blocks-idp/api-settings/models/api-endpoint.model";

const h = vi.hoisted(() => ({
  tenantId: "tenant-1",
  pages: [] as { data: IApiEndpoint[] }[],
  isLoading: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  updateEndpoint: vi.fn(),
  bulkUpdate: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));
vi.mock("@blocks-idp/api-settings/hooks/use-api-settings", () => ({
  useGetApiEndpointsInfinite: () => ({
    data: { pages: h.pages },
    isLoading: h.isLoading,
    isFetchingNextPage: h.isFetchingNextPage,
    fetchNextPage: h.fetchNextPage,
    hasNextPage: h.hasNextPage,
  }),
  useUpdateApiEndpoint: () => ({ mutateAsync: h.updateEndpoint }),
  useBulkUpdateApiEndpoints: () => ({ mutateAsync: h.bulkUpdate }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: h.showErrorToast,
  showSuccessToast: h.showSuccessToast,
}));

import ApiSettingsPage from "./api-settings";

const endpoint = (over: Partial<IApiEndpoint> = {}): IApiEndpoint =>
  ({
    itemId: "e1",
    createdDate: "",
    lastUpdatedDate: "",
    createdBy: null,
    lastUpdatedBy: "",
    language: null,
    organizationIds: [],
    tags: [],
    service: "blocks-iam",
    method: "getUser",
    httpMethod: "GET",
    description: "Fetch a user",
    isCaptchaRequired: false,
    captchaProvider: "",
    isMFARequired: false,
    mfaType: "",
    controller: "User",
    baseUrl: "https://api.acme.io",
    version: "1",
    ...over,
  }) as IApiEndpoint;

const twoEndpoints = () => [
  endpoint(),
  endpoint({ itemId: "e2", method: "createUser", httpMethod: "POST" }),
];

const expandGroup = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /User/i }));
};

describe("ApiSettingsPage interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tenantId = "tenant-1";
    h.pages = [{ data: twoEndpoints() }];
    h.isLoading = false;
    h.isFetchingNextPage = false;
    h.hasNextPage = false;
    h.updateEndpoint.mockResolvedValue({ isSuccess: true });
    h.bulkUpdate.mockResolvedValue({ isSuccess: true });
  });

  it("renders the service group with a swagger docs link", () => {
    render(<ApiSettingsPage />);
    expect(screen.getByText("blocks-iam")).toBeTruthy();
    const docs = screen.getByRole("link", { name: /API Docs/i });
    expect(docs.getAttribute("href")).toBe("https://api.acme.io/swagger/index.html");
  });

  it("toggles MFA on an endpoint and reports success", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);
    await expandGroup(user);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[0]);

    await waitFor(() => expect(h.updateEndpoint).toHaveBeenCalledTimes(1));
    expect(h.updateEndpoint.mock.calls[0][0]).toMatchObject({ itemId: "e1", isMFARequired: true });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("toggles Captcha on an endpoint", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);
    await expandGroup(user);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[1]);

    await waitFor(() => expect(h.updateEndpoint).toHaveBeenCalledTimes(1));
    expect(h.updateEndpoint.mock.calls[0][0]).toMatchObject({
      itemId: "e1",
      isCaptchaRequired: true,
    });
  });

  it("shows an error toast when a single update fails", async () => {
    const user = userEvent.setup();
    h.updateEndpoint.mockResolvedValue({ isSuccess: false, errors: ["nope"] });
    render(<ApiSettingsPage />);
    await expandGroup(user);

    const switches = await screen.findAllByRole("switch");
    await user.click(switches[0]);

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "nope" }));
  });

  it("selects an endpoint and bulk-enables MFA", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);
    await expandGroup(user);

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole("button", { name: "Enable MFA" }));
    await waitFor(() => expect(h.bulkUpdate).toHaveBeenCalledTimes(1));
    expect(h.bulkUpdate.mock.calls[0][0]).toMatchObject({ itemIds: ["e1"], isMFARequired: true });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("selects an endpoint and bulk-enables Captcha", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);
    await expandGroup(user);

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[1]);

    await user.click(screen.getByRole("button", { name: "Enable Captcha" }));
    await waitFor(() => expect(h.bulkUpdate).toHaveBeenCalledTimes(1));
    expect(h.bulkUpdate.mock.calls[0][0]).toMatchObject({
      itemIds: ["e1"],
      isCaptchaRequired: true,
    });
  });

  it("selects the whole group via the card checkbox", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    await user.click(screen.getByRole("button", { name: "Enable MFA" }));
    await waitFor(() => expect(h.bulkUpdate).toHaveBeenCalledTimes(1));
    expect(h.bulkUpdate.mock.calls[0][0].itemIds).toHaveLength(2);
  });

  it("bulk-enables MFA for a group from the security presets popover", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);

    await user.click(screen.getByRole("button", { name: /Security Presets/i }));
    await user.click(await screen.findByText("Enable all MFA"));

    await waitFor(() => expect(h.bulkUpdate).toHaveBeenCalledTimes(1));
    expect(h.bulkUpdate.mock.calls[0][0]).toMatchObject({ isMFARequired: true });
  });

  it("bulk-enables Captcha for a group from the security presets popover", async () => {
    const user = userEvent.setup();
    render(<ApiSettingsPage />);

    await user.click(screen.getByRole("button", { name: /Security Presets/i }));
    await user.click(await screen.findByText("Enable all Captcha"));

    await waitFor(() => expect(h.bulkUpdate).toHaveBeenCalledTimes(1));
    expect(h.bulkUpdate.mock.calls[0][0]).toMatchObject({ isCaptchaRequired: true });
  });

  it("surfaces an error when a bulk update fails", async () => {
    const user = userEvent.setup();
    h.bulkUpdate.mockResolvedValue({ isSuccess: false, errors: ["bulk-fail"] });
    render(<ApiSettingsPage />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole("button", { name: "Enable MFA" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledWith({ errors: "bulk-fail" }));
  });

  it("renders extra skeletons while fetching the next page", () => {
    h.isFetchingNextPage = true;
    const { container } = render(<ApiSettingsPage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
