import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mfaConfig: undefined as unknown,
  templatesData: undefined as unknown,
  isLoading: false,
  isFetching: false,
  isPending: false,
  mutateAsync: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGetMFAConfig: () => ({ data: h.mfaConfig }),
  useSaveMFAConfig: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplates: () => ({
    data: h.templatesData,
    isLoading: h.isLoading,
    isFetching: h.isFetching,
  }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => h.toast(...a) }));

import { ChooseEmailTemplate } from "./choose-email-template";

describe("ChooseEmailTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mfaConfig = { allowedMethods: [1] };
    h.templatesData = {
      templates: [{ itemId: "t1", name: "Welcome" }],
      totalCount: 1,
    };
    h.isLoading = false;
    h.isFetching = false;
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("lists the default and fetched templates", () => {
    render(<ChooseEmailTemplate open setOpen={vi.fn()} />);
    expect(screen.getByText("Choose a template")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("Welcome")).toBeTruthy();
  });

  it("keeps Choose disabled until a template is selected", () => {
    render(<ChooseEmailTemplate open setOpen={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Choose" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByText("Welcome"));
    expect((screen.getByRole("button", { name: "Choose" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("saves the mfa config and closes on success", async () => {
    const setOpen = vi.fn();
    render(<ChooseEmailTemplate open setOpen={setOpen} />);
    fireEvent.click(screen.getByText("Welcome"));
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalledWith({ enabled: true, allowedMethods: [1] }));
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when the save is unsuccessful", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false });
    render(<ChooseEmailTemplate open setOpen={vi.fn()} />);
    fireEvent.click(screen.getByText("Default"));
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("hides the template choices while templates load", () => {
    h.isLoading = true;
    render(<ChooseEmailTemplate open setOpen={vi.fn()} />);
    // During loading the skeleton replaces both the default and fetched tiles.
    expect(screen.queryByText("Welcome")).toBeNull();
    expect(screen.queryByText("Default")).toBeNull();
    expect(screen.getByText("Choose a template")).toBeTruthy();
  });
});
