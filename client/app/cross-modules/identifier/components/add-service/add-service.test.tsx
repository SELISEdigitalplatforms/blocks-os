import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  registerService: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock("@blocks-identifier/hooks/use-services", () => ({
  useRegisterService: () => ({ mutateAsync: h.registerService, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
}));

import { AddService } from "./add-service";

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Register Service" }));
  await screen.findByText("Register New Service");
};

describe("AddService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.registerService = vi.fn().mockResolvedValue({ isSuccess: true });
  });

  it("opens the register dialog from the trigger", async () => {
    const user = userEvent.setup();
    render(<AddService />);
    await openDialog(user);
    expect(screen.getByText("Register a new service to start collecting logs and traces.")).toBeTruthy();
  });

  it("keeps Save disabled until the form is dirty", async () => {
    const user = userEvent.setup();
    render(<AddService />);
    await openDialog(user);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("registers a service and shows a success toast", async () => {
    const user = userEvent.setup();
    render(<AddService />);
    await openDialog(user);
    await user.type(screen.getByPlaceholderText("Enter name"), "orders-api");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(h.registerService).toHaveBeenCalledWith(
        expect.objectContaining({ serviceName: "orders-api" }),
      ),
    );
    expect(h.showSuccessToast).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when registration is unsuccessful", async () => {
    const user = userEvent.setup();
    h.registerService = vi.fn().mockResolvedValue({ isSuccess: false, errors: "nope" });
    render(<AddService />);
    await openDialog(user);
    await user.type(screen.getByPlaceholderText("Enter name"), "orders-api");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
    expect(h.showSuccessToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when registration throws with field errors", async () => {
    const user = userEvent.setup();
    h.registerService = vi.fn().mockRejectedValue({ errors: { serviceName: "taken" } });
    render(<AddService />);
    await openDialog(user);
    await user.type(screen.getByPlaceholderText("Enter name"), "dup-service");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalledTimes(1));
  });
});
