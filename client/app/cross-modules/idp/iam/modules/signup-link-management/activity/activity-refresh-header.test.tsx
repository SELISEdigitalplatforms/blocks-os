import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  refetchQueries: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ refetchQueries: h.refetchQueries }),
}));

vi.mock("@/components/ui-kits/button/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

import { ActivityRefreshHeader } from "./activity-refresh-header";

describe("ActivityRefreshHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.refetchQueries.mockImplementation(() => Promise.resolve());
  });

  it("refetches the signup-link-summary query key (H8)", async () => {
    const user = userEvent.setup();
    render(<ActivityRefreshHeader />);
    await user.click(screen.getByTestId("activity-refresh"));
    expect(h.refetchQueries).toHaveBeenCalledWith({ queryKey: ["signup-link-summary"] });
  });
});
