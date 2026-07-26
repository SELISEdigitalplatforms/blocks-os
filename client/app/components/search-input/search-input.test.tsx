import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchInput } from "./search-input";

describe("SearchInput", () => {
  it("renders an input and forwards typed values to onSearch", () => {
    const onSearch = vi.fn();
    render(
      <SearchInput onSearch={onSearch} value="" isVisible setIsVisible={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "abc" } });
    expect(onSearch).toHaveBeenCalledWith("abc");
  });

  it("shows a clear button only when there is a value and clears on click", () => {
    const onSearch = vi.fn();
    const { rerender } = render(
      <SearchInput onSearch={onSearch} value="" isVisible setIsVisible={vi.fn()} />,
    );
    // No clear button while empty (only the input is present).
    expect(screen.queryAllByRole("button").length).toBe(0);
    rerender(<SearchInput onSearch={onSearch} value="abc" isVisible setIsVisible={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("renders a toggle button when toggleable and hidden", () => {
    const setIsVisible = vi.fn();
    render(
      <SearchInput
        onSearch={vi.fn()}
        value=""
        toggleable
        isVisible={false}
        setIsVisible={setIsVisible}
      />,
    );
    // Collapsed toggleable search shows only the search toggle button.
    expect(screen.queryByPlaceholderText("Search...")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(setIsVisible).toHaveBeenCalledWith(true);
  });

  it("hides the input again when cleared in toggleable mode", () => {
    const setIsVisible = vi.fn();
    const onSearch = vi.fn();
    render(
      <SearchInput
        onSearch={onSearch}
        value="abc"
        toggleable
        isVisible
        setIsVisible={setIsVisible}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onSearch).toHaveBeenCalledWith("");
    expect(setIsVisible).toHaveBeenCalledWith(false);
  });
});
