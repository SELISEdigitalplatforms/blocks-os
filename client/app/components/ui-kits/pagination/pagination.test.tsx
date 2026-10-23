import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PAGE_SIZE_OPTIONS, getSizeChoices, Pagination } from "./pagination";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const openSelect = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox"));
  return screen.getAllByRole("option").map((option) => option.textContent);
};

describe("Pagination", () => {
  it("shares one default set of page sizes", () => {
    expect(DEFAULT_PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });

  it("offers the default sizes when a table passes none", async () => {
    render(
      <Pagination
        page={0}
        pageSize={10}
        totalCount={100}
        onChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(await openSelect()).toEqual(["10", "25", "50"]);
  });

  it("lists a current size that is not one of the choices so the select still shows it", async () => {
    render(
      <Pagination
        page={0}
        pageSize={5}
        totalCount={100}
        onChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(await openSelect()).toEqual(["5", "10", "25", "50"]);
  });

  it("shows no size picker when nothing can change the size", () => {
    render(<Pagination page={0} pageSize={10} totalCount={100} onChange={vi.fn()} />);
    expect(screen.queryByText("Rows per page")).toBeNull();
    expect(screen.getByText("Page 1 of 10")).toBeTruthy();
  });

  it("reports the chosen size", async () => {
    const onPageSizeChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Pagination
        page={0}
        pageSize={10}
        totalCount={100}
        onChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "25" }));
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
  it("offers only sizes that change what is shown", () => {
    expect(getSizeChoices([10, 25, 50], 10, 12)).toEqual([10, 25]);
    expect(getSizeChoices([10, 25, 50], 10, 30)).toEqual([10, 25, 50]);
    expect(getSizeChoices([10, 25, 50], 25, 12)).toEqual([10, 25]);
    expect(getSizeChoices([10, 25, 50], 5, 12)).toEqual([5, 10, 25]);
  });

  it("offers no size when the smallest one fits every row", () => {
    expect(getSizeChoices([10, 25, 50], 10, 1)).toEqual([]);
    expect(getSizeChoices([], 10, 100)).toEqual([]);
  });

  it("hides the size picker for a single record but keeps the page info", () => {
    render(
      <Pagination
        page={0}
        pageSize={10}
        totalCount={1}
        onChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("Rows per page")).toBeNull();
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  });
});
