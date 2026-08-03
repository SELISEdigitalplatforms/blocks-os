import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMagicUrl, toast } = vi.hoisted(() => ({
  createMagicUrl: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@seliseblocks/genesis-os/store", () => ({
  useAuthStore: () => ({ user: { sub: "user-9" } }),
}));

vi.mock("@blocks-utilities/hooks/use-magic-url", () => ({
  useCreateMagicUrl: () => ({ mutate: createMagicUrl, isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({ toast }));

import { MagicUrlDialog } from "./magic-url-dialog";
import type { MagicUrl } from "@blocks-utilities/models/magic-url.model";

// Radix Select/Popover rely on pointer-capture / scroll APIs jsdom lacks.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

describe("MagicUrlDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the dialog header and disabled Create button when empty", () => {
    render(<MagicUrlDialog open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Magic URL")).toBeTruthy();
    expect(screen.getByText("Create a new Magic URL with custom configurations.")).toBeTruthy();
    const create = screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);
  });

  it("enables Create once a valid URI and name are entered and submits the payload", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<MagicUrlDialog open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("https://example.com"), "https://example.com");
    await user.type(screen.getByPlaceholderText("My Magic Link"), "My Link");

    const create = screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
    await waitFor(() => expect(create.disabled).toBe(false));

    await user.click(create);
    expect(createMagicUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: "https://example.com",
        name: "My Link",
        type: 1,
        projectKey: "tenant-1",
        requestByUserId: "user-9",
        usageLimit: 0,
      }),
      expect.any(Object),
    );
  });

  it("fires a success toast and closes on successful creation", async () => {
    createMagicUrl.mockImplementation((_payload, opts) => opts.onSuccess());
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<MagicUrlDialog open onOpenChange={onOpenChange} />);
    await user.type(screen.getByPlaceholderText("https://example.com"), "https://example.com");
    await user.type(screen.getByPlaceholderText("My Magic Link"), "My Link");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" })),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("fires an error toast when creation fails", async () => {
    createMagicUrl.mockImplementation((_payload, opts) => opts.onError(new Error("boom")));
    const user = userEvent.setup();
    render(<MagicUrlDialog open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("https://example.com"), "https://example.com");
    await user.type(screen.getByPlaceholderText("My Magic Link"), "My Link");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "boom" }),
      ),
    );
  });

  it("shows a validation message for an invalid URI", async () => {
    const user = userEvent.setup();
    render(<MagicUrlDialog open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("https://example.com"), "not a url");
    expect(await screen.findByText("Please enter a valid URI")).toBeTruthy();
  });

  it("reveals extra request fields when the Action type is selected", async () => {
    const user = userEvent.setup();
    render(<MagicUrlDialog open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Action" }));
    expect(await screen.findByText("Request Payload")).toBeTruthy();
    expect(screen.getByText("Request Headers")).toBeTruthy();
    expect(screen.getByText("Encoded Query String")).toBeTruthy();
  });

  it("reveals the usage limit input when the switch is toggled on", async () => {
    const user = userEvent.setup();
    render(<MagicUrlDialog open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("switch", { name: /Set Usage Limit/i }));
    expect(await screen.findByPlaceholderText("Enter usage limit")).toBeTruthy();
  });

  it("reveals a date picker when auto expiry is toggled on", async () => {
    const user = userEvent.setup();
    render(<MagicUrlDialog open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("switch", { name: /Set Auto Expiry Date/i }));
    expect(await screen.findByText("Pick a date")).toBeTruthy();
  });

  it("cancels and requests the dialog to close", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<MagicUrlDialog open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("prefills fields from initialData in edit mode", () => {
    const initial: MagicUrl = {
      itemId: "m1",
      uri: "https://edit.example.com",
      name: "Edit Link",
      type: "0",
      requestMethod: "POST",
      usageLimit: 5,
      usageCount: 0,
      shortUri: "",
      createdAt: "",
      persistent: true,
    };
    render(<MagicUrlDialog open onOpenChange={vi.fn()} initialData={initial} />);
    expect((screen.getByPlaceholderText("https://example.com") as HTMLInputElement).value).toBe(
      "https://edit.example.com",
    );
    expect((screen.getByPlaceholderText("My Magic Link") as HTMLInputElement).value).toBe(
      "Edit Link",
    );
  });
});
