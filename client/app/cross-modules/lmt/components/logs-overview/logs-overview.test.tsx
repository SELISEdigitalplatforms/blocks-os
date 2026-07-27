import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ navigate: vi.fn(), basePath: "/app/lmt" }));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => h.basePath }));

import { LogsOverview } from "./logs-overview";
import { LOG_SERVICES } from "@/cross-modules/lmt/constants/logs.constant";

describe("LogsOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a card for every log service", () => {
    render(<LogsOverview />);
    expect(screen.getByText(LOG_SERVICES[0].name)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /View logs for/ }).length).toBe(
      LOG_SERVICES.length,
    );
  });

  it("navigates when a service card is clicked", () => {
    render(<LogsOverview />);
    fireEvent.click(screen.getByLabelText(`View logs for ${LOG_SERVICES[0].name}`));
    expect(h.navigate).toHaveBeenCalledWith(`/app/lmt/logs/${LOG_SERVICES[0].routeSlug}`);
  });

  it("navigates from the View Logs button without double firing", () => {
    render(<LogsOverview />);
    fireEvent.click(screen.getAllByRole("button", { name: "View Logs" })[0]);
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith(`/app/lmt/logs/${LOG_SERVICES[0].routeSlug}`);
  });

  it("navigates on Enter and Space key presses", () => {
    render(<LogsOverview />);
    const card = screen.getByLabelText(`View logs for ${LOG_SERVICES[0].name}`);
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(h.navigate).toHaveBeenCalledTimes(2);
  });

  it("ignores other key presses", () => {
    render(<LogsOverview />);
    const card = screen.getByLabelText(`View logs for ${LOG_SERVICES[0].name}`);
    fireEvent.keyDown(card, { key: "Tab" });
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
