import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Form, FormField, FormItem } from "@/components/ui-kits/form/form";
import { MultiSelectDropdown } from "./multi-select-dropdown";

const options = [
  { label: "Open Id", value: "openid" },
  { label: "Email", value: "email" },
  { label: "Profile", value: "profile" },
];

// FormControl (used inside MultiSelectDropdown) needs a real FormField context to
// forward Radix asChild refs, so wrap the control in a minimal live form.
const Harness = ({
  value,
  onChange,
  ...rest
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const form = useForm({ defaultValues: { scope: value } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="scope"
        render={() => (
          <FormItem>
            <MultiSelectDropdown options={options} value={value} onChange={onChange} {...rest} />
          </FormItem>
        )}
      />
    </Form>
  );
};

describe("MultiSelectDropdown", () => {
  it("shows the placeholder when nothing is selected", () => {
    render(<Harness value={[]} onChange={vi.fn()} placeholder="Pick some" />);
    expect(screen.getByText("Pick some")).toBeTruthy();
  });

  it("shows the selected labels joined together", () => {
    render(<Harness value={["openid", "email"]} onChange={vi.fn()} />);
    expect(screen.getByText("Open Id, Email")).toBeTruthy();
  });

  it("falls back to a default placeholder when none is provided", () => {
    render(<Harness value={[]} onChange={vi.fn()} />);
    expect(screen.getByText("Select options")).toBeTruthy();
  });

  it("adds an option in canonical option order when toggled on", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness value={["email"]} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Open Id"));
    // Result is reordered to match the option list order, not click order.
    expect(onChange).toHaveBeenCalledWith(["openid", "email"]);
  });

  it("removes an option when toggled off", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness value={["openid", "email"]} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Open Id"));
    expect(onChange).toHaveBeenCalledWith(["email"]);
  });

  it("clears all selections through the clear action", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness value={["openid"]} onChange={onChange} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Clear selection"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("does not open when disabled", () => {
    render(<Harness value={[]} onChange={vi.fn()} disabled />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
