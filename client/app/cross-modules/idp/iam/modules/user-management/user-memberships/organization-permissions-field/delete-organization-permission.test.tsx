import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IPermission } from "@blocks-idp/iam/models/permission";

const h = vi.hoisted(() => ({ modalProps: null as Record<string, unknown> | null }));

vi.mock("@/components/confirmation-modal/confirmation-modal", () => ({
  ConfirmationModal: (props: Record<string, unknown>) => {
    h.modalProps = props;
    const data = props.data as { dialogTitle: string; dialogSubtitle: string };
    return (
      <div data-testid="confirmation-modal">
        <span>{data.dialogTitle}</span>
        <span>{data.dialogSubtitle}</span>
        <button type="button" onClick={props.onConfirm as () => void}>
          confirm
        </button>
        <button type="button" onClick={props.onCancel as () => void}>
          cancel
        </button>
      </div>
    );
  },
}));

import { DeleteOrganizationPermission } from "./delete-organization-permission";

const permission = { itemId: "p1", name: "Read", resource: "read" } as unknown as IPermission;

beforeEach(() => {
  vi.clearAllMocks();
  h.modalProps = null;
});

describe("DeleteOrganizationPermission", () => {
  it("renders the confirmation copy", () => {
    render(<DeleteOrganizationPermission permission={permission} onDelete={vi.fn()} />);
    expect(screen.getByText("Remove Permission")).toBeTruthy();
    expect(screen.getByText("Are you sure you want to remove this permission?")).toBeTruthy();
  });

  it("removes the permission when confirmed", () => {
    const onDelete = vi.fn();
    render(<DeleteOrganizationPermission permission={permission} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("confirm"));
    expect(onDelete).toHaveBeenCalledWith(permission);
  });

  it("defers the save until after the parent state update", async () => {
    const onSave = vi.fn();
    render(
      <DeleteOrganizationPermission
        permission={permission}
        onDelete={vi.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByText("confirm"));
    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("does not remove anything when cancelled", () => {
    const onDelete = vi.fn();
    render(<DeleteOrganizationPermission permission={permission} onDelete={onDelete} />);
    fireEvent.click(screen.getByText("cancel"));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
