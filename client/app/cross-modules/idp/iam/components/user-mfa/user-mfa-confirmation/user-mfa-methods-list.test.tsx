import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isLoading: false, isFetching: false, data: { allowedMethods: [1, 2] } as unknown }));

vi.mock("@blocks-idp/mfa/hooks/use-mfa-config", () => ({
  useGetMFAConfig: () => ({ isLoading: h.isLoading, isFetching: h.isFetching, data: h.data }),
}));

import { UserMFAMethodList } from "./user-mfa-methods-list";

describe("UserMFAMethodList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isLoading = false;
    h.isFetching = false;
    h.data = { allowedMethods: [1, 2] };
  });

  it("renders skeletons while loading", () => {
    h.isLoading = true;
    const { container } = render(<UserMFAMethodList selected={1} setSelected={vi.fn()} projectKey="pk" />);
    expect(container.querySelector("[class*='rounded']")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("lists the allowed MFA methods", () => {
    render(<UserMFAMethodList selected={1} setSelected={vi.fn()} projectKey="pk" />);
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("Authenticator app")).toBeTruthy();
  });

  it("renders no methods when none are allowed", () => {
    h.data = { allowedMethods: [] };
    render(<UserMFAMethodList selected={1} setSelected={vi.fn()} projectKey="pk" />);
    expect(screen.queryByText("Email")).toBeNull();
  });

  it("selects a method through the radio group", async () => {
    const setSelected = vi.fn();
    const user = userEvent.setup();
    render(<UserMFAMethodList selected={1} setSelected={setSelected} projectKey="pk" />);
    await user.click(screen.getByLabelText("Email"));
    expect(setSelected).toHaveBeenCalledWith(2);
  });
});
