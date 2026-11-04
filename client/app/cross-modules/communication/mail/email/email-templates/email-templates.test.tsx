import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmailTemplates from "./email-templates";

vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => null }));

describe("EmailTemplates", () => {
  it("shows every sample layout name from the English keys", () => {
    render(<EmailTemplates />);

    expect(screen.getAllByText("Simple Text")).toHaveLength(1);
    expect(screen.getAllByText("1:2:1:2 Column")).toHaveLength(1);
    expect(screen.getAllByText("1:2 Column")).toHaveLength(1);
    expect(screen.getAllByText("1:2 Column • Alternate")).toHaveLength(1);
    for (const number of [2, 3, 4, 5, 6, 7]) {
      expect(screen.getAllByText(`1:2 Column • Alternate • ${number}`)).toHaveLength(1);
    }
  });
});
