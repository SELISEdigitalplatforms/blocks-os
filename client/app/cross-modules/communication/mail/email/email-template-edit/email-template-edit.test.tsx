import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: undefined as unknown,
  isLoading: false,
  isFetching: false,
  saveEmailTemplate: vi.fn(),
  isPending: false,
  navigate: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("@blocks-communication/mail/hooks/use-email-template", () => ({
  useGetEmailTemplate: () => ({ data: h.data, isLoading: h.isLoading, isFetching: h.isFetching }),
  useSaveEmailTemplate: () => ({ saveEmailTemplate: h.saveEmailTemplate, isPending: h.isPending }),
}));
vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <nav /> }));
vi.mock("@blocks-communication/mail/components/bee-plugin-starter/bee-plugin-starter", () => {
  const BeePluginStarterMock = React.forwardRef(
    (props: { onBeeSave: (d: { htmlFile: string; jsonFile: string }) => void }) => (
      <button
        data-testid="bee-save"
        onClick={() => props.onBeeSave({ htmlFile: "<html/>", jsonFile: "{}" })}
      >
        bee save
      </button>
    ),
  );
  BeePluginStarterMock.displayName = "BeePluginStarterMock";
  return { default: BeePluginStarterMock };
});

import { EditEmailTemplate } from "./email-template-edit";

describe("EditEmailTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.isPending = false;
    h.data = { itemId: "t1", name: "Welcome Email", jsonContent: "" };
    h.saveEmailTemplate.mockResolvedValue(undefined);
  });

  it("renders the skeleton while the template loads", () => {
    h.isLoading = true;
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    expect(screen.queryByText("Welcome Email")).toBeNull();
    expect(screen.queryByTestId("bee-save")).toBeNull();
  });

  it("renders the action buttons and editor without a page title", () => {
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    expect(screen.queryByRole("heading", { name: "Welcome Email" })).toBeNull();
    expect(screen.getByRole("button", { name: /Reset/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Preview/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save/ })).toBeTruthy();
    expect(screen.getByTestId("bee-save")).toBeTruthy();
  });

  it("saves the template through the editor callback and navigates back", async () => {
    render(<EditEmailTemplate params={{ id: "t1" }} />);
    fireEvent.click(screen.getByTestId("bee-save"));
    await waitFor(() => expect(h.saveEmailTemplate).toHaveBeenCalled());
    expect(h.saveEmailTemplate.mock.calls[0][0]).toMatchObject({
      itemId: "t1",
      templateBody: "<html/>",
      jsonContent: "{}",
    });
    expect(h.navigate).toHaveBeenCalledWith("/app/proj/email-management/communications/t1");
  });
});
