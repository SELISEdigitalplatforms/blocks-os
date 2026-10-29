import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  useFindSecrets: vi.fn(),
  tenantId: "tenant-1",
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));
vi.mock("../../hooks/use-captcha-config", () => ({
  useGetCaptchaConfigList: () => ({ isLoading: false, isFetching: false, data: [] }),
}));
vi.mock("@/cross-modules/secrets/hooks/use-secret-management", () => ({
  useFindSecrets: h.useFindSecrets,
}));
vi.mock("./configure-captcha-list", () => ({
  ConfigureCaptchaList: () => <div data-testid="captcha-list" />,
}));

import { ConfigureCaptcha } from "./configure-captcha";

describe("ConfigureCaptcha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tenantId = "tenant-1";
  });

  it("loads the default Secret Management list alongside captcha configuration", () => {
    render(<ConfigureCaptcha />);

    expect(screen.getByTestId("captcha-list")).toBeTruthy();
    expect(h.useFindSecrets).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 10 }, true);
  });

  it("keeps the secret request disabled until a project is selected", () => {
    h.tenantId = "";
    render(<ConfigureCaptcha />);

    expect(h.useFindSecrets).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 10 }, false);
  });
});
