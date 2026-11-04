import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  error: null as unknown,
}));

vi.mock("@blocks-idp/iam/hooks/use-signup-link-configurations", () => ({
  useGetSignupLinkConfigurations: () => ({ error: h.error }),
}));

vi.mock("../configurations/configurations-filter-toolbar", () => ({
  useSignupLinkConfigurationsQueryParams: () => ({
    queryParams: { page: 0, pageSize: 10, search: "", includeInactive: false },
  }),
}));

vi.mock("./add-configuration", () => ({
  AddConfiguration: () => <button type="button">Add Configuration</button>,
}));

import { AddConfigurationHeader } from "./add-configuration-header";

describe("AddConfigurationHeader", () => {
  it("renders Add when not forbidden", () => {
    h.error = null;
    render(<AddConfigurationHeader />);
    expect(screen.getByRole("button", { name: "Add Configuration" })).toBeTruthy();
  });

  it("hides Add on 403", () => {
    h.error = { status: 403 };
    const { container } = render(<AddConfigurationHeader />);
    expect(container.textContent).toBe("");
  });
});
