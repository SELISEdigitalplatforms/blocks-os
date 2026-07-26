import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  template: null as IEmailTemplate | null,
  isLoading: false,
  isFetching: false,
  configs: [] as { itemId: string; name: string }[],
  isConfigsLoading: false,
  isConfigsFetching: false,
  sendTestMail: vi.fn(),
  isSending: false,
  user: { data: { email: "me@acme.io" } },
  navigate: vi.fn(),
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplate: () => ({
    isLoading: h.isLoading,
    isFetching: h.isFetching,
    data: h.template,
  }),
  useSendTestMail: () => ({ isPending: h.isSending, mutateAsync: h.sendTestMail }),
  useSaveMailTemplate: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailConfigs: () => ({
    isLoading: h.isConfigsLoading,
    isFetching: h.isConfigsFetching,
    data: h.configs,
  }),
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUser: () => ({ data: h.user }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => ({ isLoading: false, data: { data: [] } }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
  usePathSegments: () => [],
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: h.toast,
  showErrorToast: h.showErrorToast,
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => h.navigate };
});

import { EmailCommunicationDetails } from "./email-communication-details";

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const template = (over: Partial<IEmailTemplate> = {}): IEmailTemplate =>
  ({
    itemId: "tpl-1",
    createdDate: "2024-01-01T10:00:00Z",
    lastUpdatedDate: "2024-02-01T10:00:00Z",
    createdBy: "",
    lastUpdatedBy: "",
    organizationIds: [],
    tags: [],
    mailConfigurationId: "conf-1",
    templateBody: "<p>Hello</p>",
    jsonContent: "",
    imageId: "",
    imageUrl: "",
    language: "en-US",
    name: "Welcome Email",
    templateSubject: "Welcome!",
    generatedBy: "",
    ...over,
  }) as IEmailTemplate;

describe("EmailCommunicationDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.template = template();
    h.isLoading = false;
    h.isFetching = false;
    h.configs = [{ itemId: "conf-1", name: "Default SMTP" }];
    h.isConfigsLoading = false;
    h.isConfigsFetching = false;
    h.isSending = false;
    h.user = { data: { email: "me@acme.io" } };
    h.sendTestMail.mockResolvedValue({ isSuccess: true });
  });

  it("shows the skeleton while the template is loading", () => {
    h.template = null;
    h.isLoading = true;
    const { container } = renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("renders template details once loaded", () => {
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);
    expect(screen.getByText("Welcome Email")).toBeTruthy();
    expect(screen.getByText("Welcome!")).toBeTruthy();
    expect(screen.getByText("Default SMTP")).toBeTruthy();
    expect(screen.getByText("Template")).toBeTruthy();
  });

  it("calls the onBack handler when provided", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} onBack={onBack} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("navigates back when no onBack handler is given", async () => {
    const user = userEvent.setup();
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);
    expect(h.navigate).toHaveBeenCalledWith(-1);
  });

  it("navigates to the edit route from the template Edit button", async () => {
    const user = userEvent.setup();
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);
    const editButtons = screen.getAllByRole("button", { name: /Edit/i });
    await user.click(editButtons[0]);
    expect(h.navigate).toHaveBeenCalledWith("/scoped/email-management/communications/tpl-1/edit");
  });

  it("sends a test email and shows a success toast", async () => {
    const user = userEvent.setup();
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);

    await user.click(screen.getByRole("button", { name: /Send test Email/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(h.sendTestMail).toHaveBeenCalledWith({
        to: "me@acme.io",
        purpose: "Welcome Email",
        language: "en-US",
      }),
    );
    expect(h.toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Sent test email successfully" }),
    );
  });

  it("shows an error toast when the send is unsuccessful", async () => {
    const user = userEvent.setup();
    h.sendTestMail.mockResolvedValue({ isSuccess: false, errors: { code: "x" } });
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);

    await user.click(screen.getByRole("button", { name: /Send test Email/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("shows an error toast when the send throws", async () => {
    const user = userEvent.setup();
    h.sendTestMail.mockRejectedValue(new Error("network"));
    renderPage(<EmailCommunicationDetails params={{ id: "tpl-1" }} />);

    await user.click(screen.getByRole("button", { name: /Send test Email/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});
