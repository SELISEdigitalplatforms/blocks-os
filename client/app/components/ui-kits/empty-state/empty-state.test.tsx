import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders the description without a role by default", () => {
    render(<EmptyState icon={Inbox} title="Nothing here" description="Add the first item." />);

    expect(screen.getByText("Nothing here")).toBeTruthy();
    expect(screen.getByText("Add the first item.").getAttribute("role")).toBeNull();
  });

  it("puts the given role on the description only", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here"
        description="Add the first item."
        descriptionRole="alert"
      />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Add the first item.");
    expect(screen.getByText("Nothing here").getAttribute("role")).toBeNull();
  });
});
