import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ChipsInput,
  ChipsInputList,
  ChipsInputField,
  useChipsContext,
} from "./chips-input";

const Harness = ({
  initial = [],
  validatorRegex,
  customValidator,
  errorMessage,
}: {
  initial?: string[];
  validatorRegex?: RegExp;
  customValidator?: (v: string) => boolean;
  errorMessage?: string;
}) => {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <ChipsInput
      value={value}
      onChange={setValue}
      validatorRegex={validatorRegex}
      customValidator={customValidator}
      validatorRegexErrorMessage={errorMessage}
    >
      <ChipsInputList />
      <ChipsInputField />
    </ChipsInput>
  );
};

describe("ChipsInput", () => {
  it("adds a chip on Enter and clears the input", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText("Type and press enter");
    await user.type(input, "apple{Enter}");
    expect(screen.getByText("apple")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("renders existing chips and removes one when its X is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["one", "two"]} />);
    expect(screen.getByText("one")).toBeTruthy();
    await user.click(screen.getByLabelText("Remove one"));
    expect(screen.queryByText("one")).toBeNull();
    expect(screen.getByText("two")).toBeTruthy();
  });

  it("does not add a chip when the input is only whitespace", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText("Type and press enter");
    await user.type(input, "   {Enter}");
    expect(screen.queryByText("   ")).toBeNull();
  });

  it("shows a regex validation error and blocks adding", async () => {
    const user = userEvent.setup();
    render(<Harness validatorRegex={/^\d+$/} errorMessage="Numbers only" />);
    const input = screen.getByPlaceholderText("Type and press enter");
    await user.type(input, "abc");
    expect(screen.getByText("Numbers only")).toBeTruthy();
    await user.type(input, "{Enter}");
    // still invalid, so no chip is added
    expect(screen.queryByText("abc")).toBeNull();
  });

  it("clears the regex error once the value becomes valid", async () => {
    const user = userEvent.setup();
    render(<Harness validatorRegex={/^\d+$/} errorMessage="Numbers only" />);
    const input = screen.getByPlaceholderText("Type and press enter");
    await user.type(input, "12a");
    expect(screen.getByText("Numbers only")).toBeTruthy();
    await user.clear(input);
    await user.type(input, "123");
    expect(screen.queryByText("Numbers only")).toBeNull();
  });

  it("uses a custom validator when provided", async () => {
    const user = userEvent.setup();
    const customValidator = vi.fn((v: string) => v.startsWith("x"));
    render(<Harness customValidator={customValidator} errorMessage="Must start with x" />);
    const input = screen.getByPlaceholderText("Type and press enter");
    await user.type(input, "yes");
    expect(screen.getByText("Must start with x")).toBeTruthy();
    expect(customValidator).toHaveBeenCalled();
  });

  it("throws when the context hook is used outside the provider", () => {
    const Bad = () => {
      useChipsContext();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ChipsInput components must be used/);
    spy.mockRestore();
  });
});
