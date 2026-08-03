import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityList, toActivityRows } from "./activity-list";
import type { IActivityRowViewModel } from "../view-models/activity.view-model";

const rows: IActivityRowViewModel[] = [
  {
    id: "1",
    eventLabel: "Signed in",
    deviceLabel: "Mac",
    ipAddress: "1.2.3.4",
    timestampDisplay: "just now",
    tone: "success",
  },
  {
    id: "2",
    eventLabel: "Blocked login",
    deviceLabel: "Windows",
    ipAddress: "5.6.7.8",
    timestampDisplay: "1h ago",
    tone: "danger",
  },
];

describe("ActivityList", () => {
  it("renders a loading skeleton while loading", () => {
    const { container } = render(<ActivityList isLoading={true} rows={[]} />);
    expect(container.querySelectorAll("[class*='rounded']").length).toBeGreaterThan(0);
    expect(screen.queryByText("Event")).toBeNull();
  });

  it("renders the empty state when there are no rows", () => {
    render(<ActivityList isLoading={false} rows={[]} />);
    expect(screen.getByText("No activity yet")).toBeTruthy();
  });

  it("renders a table row per activity", () => {
    render(<ActivityList isLoading={false} rows={rows} />);
    expect(screen.getByText("Signed in")).toBeTruthy();
    expect(screen.getByText("Blocked login")).toBeTruthy();
    expect(screen.getByText("1.2.3.4")).toBeTruthy();
    expect(screen.getByText("Event")).toBeTruthy();
  });

  it("maps activity api items to row view models", () => {
    const mapped = toActivityRows([
      {
        itemId: "a1",
        event: "Login",
        outcome: "Success",
        createdDate: "2025-01-01T00:00:00Z",
        context: { ipAddress: "9.9.9.9", deviceName: "Phone" },
      } as unknown as Parameters<typeof toActivityRows>[0][number],
    ]);
    expect(mapped[0].id).toBe("a1");
    expect(mapped[0].tone).toBe("success");
    expect(mapped[0].ipAddress).toBe("9.9.9.9");
  });
});
