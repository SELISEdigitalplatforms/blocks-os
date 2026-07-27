import { act, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";

const h = vi.hoisted(() => ({
  configs: { isLoading: false, data: [] as unknown },
  languages: { isLoading: false, data: [] as unknown },
}));

vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailConfigs: () => h.configs,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: () => h.languages,
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
    render(<BasicInformation onSubmit={vi.fn()} templateData={template()} />);
    expect(screen.getByText("About the Template")).toBeTruthy();
    expect(screen.getByDisplayValue("WelcomeEmail")).toBeTruthy();
    expect(screen.getByDisplayValue("Welcome aboard")).toBeTruthy();
  });

  it("does not render the card while data is still loading", () => {
    h.configs = { isLoading: true, data: undefined };
    render(<BasicInformation onSubmit={vi.fn()} templateData={template()} />);
    expect(screen.queryByText("About the Template")).toBeNull();
    expect(screen.getByLabelText("Loading form")).toBeTruthy();
  });

  it("reports validity to the parent for a valid template", async () => {
    const onValidityChange = vi.fn();
    render(
      <BasicInformation
        onSubmit={vi.fn()}
        templateData={template()}
        onValidityChange={onValidityChange}
      />,
    );
    await waitFor(() => expect(onValidityChange).toHaveBeenCalledWith(true));
  });

  it("submits the form through the imperative ref handle", async () => {
    const onSubmit = vi.fn();
    const ref = createRef<ImperativeRef>();
    render(<BasicInformation ref={ref} onSubmit={onSubmit} templateData={template()} />);

    await waitFor(() => expect(ref.current?.isValid).toBe(true));
    await act(async () => {
      ref.current?.submit();
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0] as { name: string };
    expect(submitted.name).toBe("WelcomeEmail");
  });
});
