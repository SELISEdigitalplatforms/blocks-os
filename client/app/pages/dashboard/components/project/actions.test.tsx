import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ user: { sub: "user-1" } as { sub: string } | undefined }));

vi.mock("./archive", () => ({ ArchiveProject: () => <div data-testid="archive" /> }));
vi.mock("@seliseblocks/genesis-os/components", () => ({
  RenderConditionally: ({ condition, children }: { condition: boolean; children: React.ReactNode }) =>
    condition ? <>{children}</> : null,
}));
vi.mock("@seliseblocks/genesis-os/store", () => ({ useAuthStore: () => ({ user: h.user }) }));

import { ProjectActions } from "./actions";

describe("ProjectActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.user = { sub: "user-1" };
  });

  it("renders the archive action for the owner when the project is enabled", () => {
    render(<ProjectActions itemId="item-1" isDisabled={false} createdBy="user-1" />);
    expect(screen.getByTestId("archive")).toBeTruthy();
  });

  it("hides the actions for a non-owner", () => {
    render(<ProjectActions itemId="item-1" isDisabled={false} createdBy="someone-else" />);
    expect(screen.queryByTestId("archive")).toBeNull();
  });

  it("hides the actions when the project is disabled", () => {
    render(<ProjectActions itemId="item-1" isDisabled createdBy="user-1" />);
    expect(screen.queryByTestId("archive")).toBeNull();
  });

  it("renders a skeleton while fetching", () => {
    const { container } = render(
      <ProjectActions itemId="item-1" isDisabled={false} createdBy="user-1" isFetching />,
    );
    expect(container.querySelector("[class*='rounded']")).toBeTruthy();
    expect(screen.queryByTestId("archive")).toBeNull();
  });
});
