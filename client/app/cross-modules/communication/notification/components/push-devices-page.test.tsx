import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEVICES_TEXT } from "../constants/push-ui.constant";

const h = vi.hoisted(() => ({ query: vi.fn(), remove: vi.fn(), toast: vi.fn() }));
const PIXEL = "Pixel 8";
const RECENT = new Date(Date.now() - 3_600_000).toISOString();

vi.mock("@seliseblocks/genesis-os/hooks", () => ({ useDebounce: <T,>(value: T) => value }));
vi.mock("../hooks/use-push-runtime", () => ({
  usePushDevices: (query: unknown) => {
    h.query(query);
    return {
      isLoading: false,
      isError: false,
      data: {
        totalCount: 2,
        counts: { all: 2, android: 1, ios: 1, web: 0 },
        items: [
          {
            id: "d1",
            userId: "u1",
            userName: "Ana",
            platform: "android",
            name: PIXEL,
            lastSeenAt: RECENT,
          },
          {
            id: "d2",
            userId: "u2",
            userName: "Bo",
            platform: "ios",
            name: "iPhone 15",
            lastSeenAt: RECENT,
          },
        ],
      },
    };
  },
  useRemovePushDevice: () => ({ mutateAsync: h.remove, isPending: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: h.toast, showSuccessToast: h.toast }));

import { PushDevicesPage } from "./push-devices-page";

const lastQuery = () => h.query.mock.calls.at(-1)?.[0];

describe("PushDevicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.remove.mockResolvedValue(undefined);
  });

  it("filters by platform with the counts on the buttons and goes back to page 1", async () => {
    const user = userEvent.setup();
    render(<PushDevicesPage onBack={vi.fn()} />);
    expect(lastQuery()).toMatchObject({ platform: undefined, page: 1 });
    await user.click(screen.getByRole("button", { name: "iOS 1" }));
    expect(lastQuery()).toMatchObject({ platform: "ios", page: 1 });
  });

  it("searches by user", async () => {
    const user = userEvent.setup();
    render(<PushDevicesPage onBack={vi.fn()} />);
    await user.type(screen.getByLabelText(DEVICES_TEXT.search), "ana");
    expect(lastQuery()).toMatchObject({ search: "ana" });
  });

  it("removes a device only after the admin confirms", async () => {
    const user = userEvent.setup();
    render(<PushDevicesPage onBack={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: DEVICES_TEXT.remove })[0]);
    expect(h.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: DEVICES_TEXT.confirmYes }));
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith("d1"));
  });

  it("keeps the device when the admin cancels", async () => {
    const user = userEvent.setup();
    render(<PushDevicesPage onBack={vi.fn()} />);
    await user.click(screen.getAllByRole("button", { name: DEVICES_TEXT.remove })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(h.remove).not.toHaveBeenCalled();
  });
});
