import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  shellProps: null as Record<string, unknown> | null,
  tenantId: "tenant-1" as string | undefined,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));
vi.mock("@blocks-idp/iam/components/user-profile-shell", () => ({
  UserProfileShell: (props: Record<string, unknown>) => {
    h.shellProps = props;
    return <div data-testid="shell" />;
  },
}));
vi.mock("./user-action-menu", () => ({
  UserActionMenu: () => <div data-testid="action-menu" />,
}));
vi.mock("../user-devices/user-devices", () => ({
  UserDevices: () => <div data-testid="devices" />,
}));
vi.mock("../user-histories", () => ({
  UserHistories: () => <div data-testid="histories" />,
}));
vi.mock("../user-access", () => ({
  UserAccessTab: () => <div data-testid="access" />,
}));

import { User } from "./user";

type Tab = { value: string; label: string; render: () => React.ReactNode };

beforeEach(() => {
  vi.clearAllMocks();
  h.shellProps = null;
  h.tenantId = "tenant-1";
});

describe("User", () => {
  it("renders the profile shell with the selected project's tenant id", () => {
    render(<User id="u1" />);
    expect(screen.getByTestId("shell")).toBeTruthy();
    expect(h.shellProps?.id).toBe("u1");
    expect(h.shellProps?.projectKey).toBe("tenant-1");
    expect(h.shellProps?.defaultTab).toBe("access");
  });

  it("falls back to an empty tenant id when no project is selected", () => {
    h.tenantId = undefined;
    render(<User id="u1" />);
    expect(h.shellProps?.projectKey).toBe("");
  });

  it("exposes the Access, Sessions and History tabs in order", () => {
    render(<User id="u1" />);
    const tabs = h.shellProps?.tabs as Tab[];
    expect(tabs.map((tab) => tab.value)).toEqual(["access", "devices", "history"]);
    expect(tabs.map((tab) => tab.label)).toEqual(["Access", "Sessions", "History"]);
  });

  it("renders each tab's body from its render callback", () => {
    render(<User id="u1" />);
    const tabs = h.shellProps?.tabs as Tab[];
    tabs.forEach((tab) => {
      const { getByTestId, unmount } = render(<>{tab.render()}</>);
      expect(getByTestId(tab.value === "history" ? "histories" : tab.value)).toBeTruthy();
      unmount();
    });
  });

  it("puts the action menu in the shell's right slot", () => {
    render(<User id="u1" />);
    const { getByTestId } = render(<>{h.shellProps?.rightSlot as React.ReactNode}</>);
    expect(getByTestId("action-menu")).toBeTruthy();
  });
});
