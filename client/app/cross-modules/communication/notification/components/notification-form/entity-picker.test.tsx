import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EntityPicker } from "./entity-picker";

const options = [
  { value: "sales", label: "Sales" },
  { value: "ops", label: "Operations" },
];

const setup = (values: string[], max = 50) => {
  const onChange = vi.fn();
  render(
    <EntityPicker
      label="Roles"
      placeholder="Search roles"
      values={values}
      max={max}
      onChange={onChange}
      useSearch={() => ({ options, isLoading: false })}
    />,
  );
  return onChange;
};

describe("EntityPicker", () => {
  it("adds a match and offers only values not yet chosen", async () => {
    const user = userEvent.setup();
    const onChange = setup(["sales"]);
    await user.click(screen.getByRole("textbox", { name: "Roles" }));
    expect(screen.queryByRole("button", { name: "Sales" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Operations" }));
    expect(onChange).toHaveBeenCalledWith(["sales", "ops"]);
  });

  it("removes a chosen value", async () => {
    const user = userEvent.setup();
    const onChange = setup(["sales", "ops"]);
    await user.click(screen.getByRole("button", { name: "Remove sales" }));
    expect(onChange).toHaveBeenCalledWith(["ops"]);
  });

  it("stops adding at the limit", () => {
    setup(["sales"], 1);
    expect((screen.getByRole("textbox", { name: "Roles" }) as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
