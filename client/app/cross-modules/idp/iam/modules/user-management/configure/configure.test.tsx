import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isLoading: false,
  data: undefined as unknown,
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-iam-configuration", () => ({
  useGetIamConfiguration: () => ({ isLoading: h.isLoading, data: h.data }),
  useSaveIamConfiguration: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({
  default: () => <nav data-testid="breadcrumb" />,
}));

import { Configure } from "./configure";

const renderConfigure = () =>
  render(
    <MemoryRouter>
      <Configure />
    </MemoryRouter>,
  );

describe("Configure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isPending = false;
    h.data = {
      data: {
        accountActivationUrl: "https://a",
        accountVerificationUrl: "https://v",
        recoverAccountUrl: "https://r",
        activationUrlLifetimeInMinutes: 30,
        recoverAccountUrlLifetimeInMinutes: 60,
        logoutOnPasswordChange: true,
      },
    };
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("shows skeletons while the configuration loads", () => {
    h.isLoading = true;
    const { container } = renderConfigure();
    expect(screen.getByText("User Configuration")).toBeTruthy();
    expect(container.querySelectorAll("form").length).toBe(0);
  });

  it("renders the form fields populated from the fetched config", () => {
    renderConfigure();
    expect((screen.getByPlaceholderText("Enter account activation url") as HTMLInputElement).value).toBe(
      "https://a",
    );
    expect((screen.getByPlaceholderText("Enter recovery account URL") as HTMLInputElement).value).toBe(
      "https://r",
    );
  });

  it("submits the form with the active tenant key and reports success", async () => {
    renderConfigure();
    const input = screen.getByPlaceholderText("Enter account activation url");
    fireEvent.change(input, { target: { value: "https://changed" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({ projectKey: "tenant-1" });
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("shows an error toast when saving throws a known error", async () => {
    h.mutateAsync.mockRejectedValueOnce({ errors: { general: "bad" } });
    renderConfigure();
    const input = screen.getByPlaceholderText("Enter account activation url");
    fireEvent.change(input, { target: { value: "https://x" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });
});
