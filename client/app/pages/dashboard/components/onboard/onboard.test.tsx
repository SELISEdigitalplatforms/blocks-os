import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  project: { tenantId: "tenant-1", name: "Acme App" } as Record<string, unknown> | undefined,
}));

vi.mock("@/hooks/use-project", () => ({
  useGetProject: () => ({ data: h.project ? { data: h.project } : undefined }),
}));
vi.mock("./onboard-dialog", () => ({
  OnboardDialog: ({ open, project }: { open: boolean; project?: { tenantId: string } }) =>
    open ? <div data-testid="onboard-dialog">{project?.tenantId}</div> : null,
}));

import { OnboardProject } from "./onboard";

describe("OnboardProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.project = { tenantId: "tenant-1", name: "Acme App" };
  });

  it("opens the dialog with the selected project", async () => {
    const user = userEvent.setup();
    render(<OnboardProject />);

    expect(screen.queryByTestId("onboard-dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Bootstrap" }));

    expect(screen.getByTestId("onboard-dialog").textContent).toBe("tenant-1");
  });

  it("still renders while the project is unavailable", () => {
    h.project = undefined;
    render(<OnboardProject />);
    expect(screen.getByRole("button", { name: "Bootstrap" })).toBeTruthy();
  });
});
