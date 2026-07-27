import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailTemplate } from "../../../models/email";

const h = vi.hoisted(() => ({
  configs: { isLoading: false, data: [] as unknown },
  languages: { isLoading: false, data: [] as unknown },
  saveTemplate: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailConfigs: () => h.configs,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => h.languages,
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useSaveMailTemplate: () => ({ isPending: h.isPending, mutateAsync: h.saveTemplate }),
}));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...args: unknown[]) => h.showErrorToast(...args),
}));

import BasicInformation from "./basic-information";

type ImperativeRef = { submit: () => void; isValid: boolean };

const template = (over: Partial<IEmailTemplate> = {}): IEmailTemplate =>
  ({
    itemId: "tpl-1",
    mailConfigurationId: "cfg-1",
    language: "en",
    name: "WelcomeEmail",
    templateSubject: "Welcome aboard",
    generatedBy: "system",
    ...over,
  }) as IEmailTemplate;

describe("BasicInformation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.saveTemplate.mockResolvedValue({ isSuccess: true, itemId: "tpl-new" });
    h.configs = {
      isLoading: false,
      data: [
        { itemId: "cfg-1", name: "Primary SMTP", isInbound: false },
        { itemId: "cfg-2", name: "Inbound Only", isInbound: true },
      ],
    };
    h.languages = {
      isLoading: false,
      data: [{ languageCode: "en", languageName: "English" }],
    };
  });

  it("renders the template fields once configs and languages have loaded", () => {
    render(<BasicInformation templateData={template()} />);
    expect(screen.getByText("About the Template")).toBeTruthy();
    expect(screen.getByDisplayValue("WelcomeEmail")).toBeTruthy();
    expect(screen.getByDisplayValue("Welcome aboard")).toBeTruthy();
  });

  it("does not render the card while data is still loading", () => {
    h.configs = { isLoading: true, data: undefined };
    render(<BasicInformation templateData={template()} />);
    expect(screen.queryByText("About the Template")).toBeNull();
    expect(screen.getByLabelText("Loading form")).toBeTruthy();
  });

  it("reports validity to the parent for a valid template", async () => {
    const onValidityChange = vi.fn();
    render(
      <BasicInformation templateData={template()} onValidityChange={onValidityChange} />,
    );
    await waitFor(() => expect(onValidityChange).toHaveBeenCalledWith(true));
  });

  it("saves the template and calls onSaveSuccess when the API succeeds", async () => {
    const onSaveSuccess = vi.fn();
    const ref = createRef<ImperativeRef>();
    render(
      <BasicInformation ref={ref} onSaveSuccess={onSaveSuccess} templateData={template()} />,
    );

    await waitFor(() => expect(ref.current?.isValid).toBe(true));
    await act(async () => {
      ref.current?.submit();
    });
    await waitFor(() => expect(h.saveTemplate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSaveSuccess).toHaveBeenCalledTimes(1));
    expect(onSaveSuccess.mock.calls[0][0]).toMatchObject({
      name: "WelcomeEmail",
      itemId: "tpl-new",
    });
  });

  it("shows an error toast when the API returns isSuccess false", async () => {
    h.saveTemplate.mockResolvedValue({
      isSuccess: false,
      itemId: null,
      errors: { "": "Template with the same Name and Language already exists" },
    });
    const onSaveSuccess = vi.fn();
    const ref = createRef<ImperativeRef>();
    render(
      <BasicInformation ref={ref} onSaveSuccess={onSaveSuccess} templateData={template()} />,
    );

    await waitFor(() => expect(ref.current?.isValid).toBe(true));
    await act(async () => {
      ref.current?.submit();
    });
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(h.showErrorToast).toHaveBeenCalledWith({
      errors: { "": "Template with the same Name and Language already exists" },
    });
    expect(onSaveSuccess).not.toHaveBeenCalled();
  });

  it("deduplicates languages that share the same languageCode", async () => {
    h.languages = {
      isLoading: false,
      data: [
        {
          itemId: "1",
          languageName: "English",
          languageCode: "en-US",
          isDefault: true,
        },
        {
          itemId: "2",
          languageName: "German",
          languageCode: "de-DE",
          isDefault: false,
        },
        {
          itemId: "3",
          languageName: "English",
          languageCode: "en-US",
          isDefault: false,
        },
        {
          itemId: "4",
          languageName: "German",
          languageCode: "de-DE",
          isDefault: false,
        },
      ],
    };

    const user = userEvent.setup();
    render(<BasicInformation templateData={template({ language: "en-US" })} />);

    await waitFor(() => expect(screen.getByText("About the Template")).toBeTruthy());
    await user.click(screen.getByRole("combobox", { name: /language/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });
    expect(screen.getByRole("option", { name: "English" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "German" })).toBeTruthy();
  });
});
