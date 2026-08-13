import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SECRET_TYPE } from "@/cross-modules/secrets/models/secret.model";
import type { SecretAccess } from "@/cross-modules/secrets/models/secret.model";
import { FakeHttpError, SECRET_ID, makeSecret } from "@/cross-modules/secrets/test-utils/secret.fixtures";

const hoisted = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  updateAccess: vi.fn(),
}));

vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useSetSecret: () => ({ mutateAsync: hoisted.create, isPending: false }),
  useUpdateSecret: () => ({ mutateAsync: hoisted.update, isPending: false }),
  useUpdateSecretAccess: () => ({ mutateAsync: hoisted.updateAccess, isPending: false }),
}));

// The picker's IAM lookups are exercised in its own suite; here it only needs to let a test
// change the access list.
vi.mock("../user-role-picker/user-role-picker", () => ({
  UserRolePicker: ({
    value,
    onChange,
  }: {
    value: SecretAccess;
    onChange: (access: SecretAccess) => void;
  }) => (
    <div>
      <span data-testid="access-summary">{`${value.userIds.length}:${value.roles.length}`}</span>
      <button
        type="button"
        onClick={() => onChange({ ...value, roles: [...value.roles, "admin"] })}
      >
        add-role
      </button>
    </div>
  ),
}));

import { SecretFormModal } from "./secret-form-modal";

const renderCreate = () => {
  const onOpenChange = vi.fn();
  render(<SecretFormModal open onOpenChange={onOpenChange} />);
  return { onOpenChange };
};

const renderEdit = (secret = makeSecret()) => {
  const onOpenChange = vi.fn();
  render(<SecretFormModal open onOpenChange={onOpenChange} secret={secret} />);
  return { onOpenChange };
};

const fillCreate = async (
  user: ReturnType<typeof userEvent.setup>,
  { name = "payment-key", value = "s3cret" } = {},
) => {
  await user.clear(screen.getByLabelText(/^name/i));
  await user.type(screen.getByLabelText(/^name/i), name);
  if (value) await user.type(screen.getByLabelText(/secret value/i), value);
};

describe("SecretFormModal — create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.create.mockResolvedValue({ secretId: SECRET_ID });
  });

  it("has no Status field — every secret is created active", () => {
    renderCreate();
    expect(screen.queryByLabelText(/status/i)).toBeNull();
  });

  it("has no managed-by or resource-reference fields — they do not exist in the API", () => {
    renderCreate();
    expect(screen.queryByLabelText(/managed by/i)).toBeNull();
    expect(screen.queryByLabelText(/resource/i)).toBeNull();
  });

  it("requires a name and a value", async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("A name is required.")).toBeTruthy());
    expect(screen.getByText("A value is required.")).toBeTruthy();
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it("rejects a name that breaks the backend pattern", async () => {
    const user = userEvent.setup();
    renderCreate();
    await fillCreate(user, { name: "_leading-underscore" });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText(/Start with a letter or digit/i)).toBeTruthy(),
    );
    expect(hoisted.create).not.toHaveBeenCalled();
  });

  it("shows no size counter and does not police the length itself", async () => {
    // The 25 KB vault cap is enforced server-side; a byte counter in the form is noise for a
    // limit almost nobody reaches, and an oversized value still fails clearly via the 400 below.
    const user = userEvent.setup();
    renderCreate();

    expect(screen.queryByText(/KB of/i)).toBeNull();

    await fillCreate(user, { name: "payment-key", value: "" });
    await user.click(screen.getByLabelText(/secret value/i));
    await user.paste("a".repeat(30_000));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(hoisted.create).toHaveBeenCalled());
  });

  it("surfaces the server's VALUE_TOO_LARGE on the value field", async () => {
    const user = userEvent.setup();
    renderCreate();
    hoisted.create.mockRejectedValue(new FakeHttpError(400, { reason: "VALUE_TOO_LARGE" }));

    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText(/larger than the 25 KB limit/i)).toBeTruthy(),
    );
  });

  it("sends lowercase wire values and the chosen access list for an api secret", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderCreate();
    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: "add-role" }));

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(hoisted.create).toHaveBeenCalledWith({
        name: "payment-key",
        description: undefined,
        value: "s3cret",
        type: "api",
        access: { userIds: [], roles: ["admin"] },
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends access: null for a service secret and hides the picker", async () => {
    const user = userEvent.setup();
    renderCreate();

    await user.click(screen.getByRole("radio", { name: /Platform service/ }));
    expect(screen.queryByTestId("access-summary")).toBeNull();

    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(hoisted.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: "service", access: null }),
      ),
    );
  });

  it("maps NAME_TAKEN onto the name field rather than a generic banner", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderCreate();
    hoisted.create.mockRejectedValue(new FakeHttpError(400, { reason: "NAME_TAKEN" }));

    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("A secret with this name already exists.")).toBeTruthy(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows a banner for an error that belongs to no field", async () => {
    const user = userEvent.setup();
    renderCreate();
    hoisted.create.mockRejectedValue(new FakeHttpError(502, {}));

    await fillCreate(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/secret store is currently unavailable/i),
    );
  });
});

describe("SecretFormModal — edit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.update.mockResolvedValue({ isSuccess: true });
    hoisted.updateAccess.mockResolvedValue({ isSuccess: true });
  });

  it("prefills the metadata and offers no value field", () => {
    renderEdit();
    expect((screen.getByLabelText(/^name/i) as HTMLInputElement).value).toBe(
      "payment-gateway-key",
    );
    // Changing a value is a rotation, which is audited separately.
    expect(screen.queryByLabelText(/secret value/i)).toBeNull();
  });

  it("does not offer a type change", () => {
    renderEdit();
    expect(screen.queryByRole("radio", { name: /Platform service/ })).toBeNull();
    expect(screen.getByText("Application")).toBeTruthy();
  });

  it("updates metadata only when the access list is untouched", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderEdit();

    await user.clear(screen.getByLabelText(/^name/i));
    await user.type(screen.getByLabelText(/^name/i), "renamed-key");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(hoisted.update).toHaveBeenCalledWith({
        secretId: SECRET_ID,
        name: "renamed-key",
        description: "Used by the checkout service",
      }),
    );
    // ::access is separately permissioned; firing it when nothing changed can fail for a user
    // who is perfectly entitled to rename the secret.
    expect(hoisted.updateAccess).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("issues the second call only when the chips actually changed", async () => {
    const user = userEvent.setup();
    renderEdit();

    await user.click(screen.getByRole("button", { name: "add-role" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(hoisted.updateAccess).toHaveBeenCalledWith({
        secretId: SECRET_ID,
        access: { userIds: [], roles: ["admin"] },
      }),
    );
    expect(hoisted.update).toHaveBeenCalledTimes(1);
  });

  it("ignores access order when deciding whether it changed", async () => {
    const user = userEvent.setup();
    renderEdit(makeSecret({ access: { userIds: ["u-2", "u-1"], roles: [] } }));

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(hoisted.update).toHaveBeenCalled());
    expect(hoisted.updateAccess).not.toHaveBeenCalled();
  });

  it("says so plainly when metadata saved but the access call was refused", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderEdit();
    hoisted.updateAccess.mockRejectedValue(new FakeHttpError(403, {}));

    await user.click(screen.getByRole("button", { name: "add-role" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /name and description were saved, but the access list was not/i,
      ),
    );
    // The modal stays open so the half-applied change is visible and retryable.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("retries only the access call after a partial failure", async () => {
    const user = userEvent.setup();
    renderEdit();
    hoisted.updateAccess.mockRejectedValueOnce(new FakeHttpError(403, {}));

    await user.click(screen.getByRole("button", { name: "add-role" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(hoisted.updateAccess).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Retry access update" }));

    await waitFor(() => expect(hoisted.updateAccess).toHaveBeenCalledTimes(2));
    // Metadata is already committed; redoing it would be a pointless second write.
    expect(hoisted.update).toHaveBeenCalledTimes(1);
  });

  it("keeps the modal open when the metadata call itself fails", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderEdit();
    hoisted.update.mockRejectedValue(new FakeHttpError(400, { reason: "NAME_TAKEN" }));

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("A secret with this name already exists.")).toBeTruthy(),
    );
    expect(hoisted.updateAccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("shows no access picker for a service secret", () => {
    renderEdit(makeSecret({ type: SECRET_TYPE.Service, access: null }));
    expect(screen.queryByTestId("access-summary")).toBeNull();
  });
});
