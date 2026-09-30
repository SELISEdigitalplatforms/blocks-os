import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationSetupModal } from "./integration-setup-modal";

const mocks = vi.hoisted(() => ({
  runSetup: vi.fn(),
  refetch: vi.fn(),
  templatesResult: {} as Record<string, unknown>,
}));

vi.mock("@/cross-modules/integration/hooks/use-integration", () => ({
  useIntegrationTemplates: () => mocks.templatesResult,
  useRunIntegrationSetup: () => ({ mutate: mocks.runSetup, isPending: false }),
}));

const template = {
  key: "localization-read",
  displayName: "Localization Read",
  description: "Read localization keys and translations.",
  roleName: "Localization Integrator (Read)",
  permissions: ["read-keys", "read-translations", "read-languages"],
};

describe("IntegrationSetupModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.templatesResult = { data: [template], isLoading: false, isError: false, refetch: mocks.refetch };
  });

  it("presents clear access choices and creates a named connection", async () => {
    const onOpenChange = vi.fn();
    const onCreated = vi.fn();
    const response = { isSuccess: true, clientSecret: "one-time-secret" };
    mocks.runSetup.mockImplementation((_payload, options: { onSuccess: (result: typeof response) => void }) => {
      options.onSuccess(response);
    });

    render(<IntegrationSetupModal open onOpenChange={onOpenChange} onCreated={onCreated} />);
    const user = userEvent.setup();

    expect(screen.getByText("Add connection")).toBeTruthy();
    expect(screen.getByText("3 permissions")).toBeTruthy();
    const create = screen.getByRole("button", { name: "Create connection" }) as HTMLButtonElement;
    expect(create.disabled).toBe(true);

    await user.click(screen.getByText("Localization Read"));
    await user.type(screen.getByLabelText("Connection name"), "  CMS connector  ");
    expect(create.disabled).toBe(false);
    await user.click(create);

    expect(mocks.runSetup).toHaveBeenCalledWith(
      { templateKey: "localization-read", connectionName: "CMS connector" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onCreated).toHaveBeenCalledWith(response);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers a retry when access options cannot be loaded", async () => {
    mocks.templatesResult = { data: [], isLoading: false, isError: true, refetch: mocks.refetch };
    render(<IntegrationSetupModal open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Access options could not be loaded.")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Create connection" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
