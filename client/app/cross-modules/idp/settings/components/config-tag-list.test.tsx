import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ConfigTagList } from "./config-tag-list";

describe("ConfigTagList", () => {
  it("renders the empty label when there are no items", () => {
    render(<ConfigTagList items={[]} emptyLabel="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeTruthy();
  });

  it("uses the default empty label", () => {
    render(<ConfigTagList items={[]} />);
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("renders every tag when the list is short", () => {
    render(<ConfigTagList items={["a", "b", "c"]} />);
    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("c")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("collapses a long list and toggles show more/less", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
    render(<ConfigTagList items={items} />);
    // Only the first 8 are visible initially.
    expect(screen.queryByText("tag-8")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Show 3 more" });
    await user.click(toggle);
    expect(screen.getByText("tag-10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("tag-8")).toBeNull();
  });
});
