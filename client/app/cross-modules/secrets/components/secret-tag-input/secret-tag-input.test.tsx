import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SECRET_TAG_MAX_PER_SECRET } from "@/cross-modules/secrets/models/secret.model";
import { SecretTagInput } from "./secret-tag-input";

const CATALOGUE = [
  { key: "iam", label: "Blocks Iam" },
  { key: "os", label: "Blocks Logic" },
];

const renderInput = (value: string[] = [], catalogue = CATALOGUE) => {
  const onChange = vi.fn();
  render(
    <SecretTagInput value={value} onChange={onChange} catalogue={catalogue} />,
  );
  return { onChange };
};

const openPicker = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Add tag" }));
  return screen.getByPlaceholderText("Search or type a new tag");
};

describe("SecretTagInput", () => {
  describe("selected chips", () => {
    it("renders a selected tag under its catalogue label, not its key", () => {
      renderInput(["iam"]);

      expect(screen.getByText("Blocks Iam")).toBeTruthy();
      expect(screen.queryByText("iam")).toBeNull();
    });

    it("falls back to the key when the catalogue has no entry", () => {
      // A tag added on another screen, or before the catalogue was seeded, still has to render.
      renderInput(["payments"]);

      expect(screen.getByText("payments")).toBeTruthy();
    });

    it("removes a chip", async () => {
      const user = userEvent.setup();
      const { onChange } = renderInput(["iam", "os"]);

      await user.click(screen.getByRole("button", { name: "Remove Blocks Iam" }));

      expect(onChange).toHaveBeenCalledWith(["os"]);
    });

    it("renders no chip list when nothing is selected", () => {
      renderInput([]);

      expect(screen.queryByRole("list", { name: "Selected tags" })).toBeNull();
    });
  });

  describe("adding from the catalogue", () => {
    it("offers a suggestion and adds its key", async () => {
      const user = userEvent.setup();
      const { onChange } = renderInput([]);

      await openPicker(user);
      await user.click(screen.getByText("Blocks Logic"));

      expect(onChange).toHaveBeenCalledWith(["os"]);
    });

    it("hides a suggestion that is already selected", async () => {
      const user = userEvent.setup();
      renderInput(["iam"]);

      await openPicker(user);

      // The chip above still shows the label, so scope the assertion to the listbox.
      expect(screen.queryByRole("option", { name: /Blocks Iam/ })).toBeNull();
      expect(screen.getByRole("option", { name: /Blocks Logic/ })).toBeTruthy();
    });

    it("filters suggestions by label", async () => {
      const user = userEvent.setup();
      renderInput([]);

      const input = await openPicker(user);
      await user.type(input, "logic");

      await waitFor(() => expect(screen.queryByText("Blocks Iam")).toBeNull());
      expect(screen.getByText("Blocks Logic")).toBeTruthy();
    });
  });

  describe("adding free text", () => {
    it("slugifies a typed phrase rather than rejecting it", async () => {
      const user = userEvent.setup();
      const { onChange } = renderInput([]);

      const input = await openPicker(user);
      await user.type(input, "Payments Team");
      await user.click(screen.getByText("payments-team"));

      expect(onChange).toHaveBeenCalledWith(["payments-team"]);
    });

    it("offers nothing to create from punctuation alone", async () => {
      const user = userEvent.setup();
      renderInput([]);

      const input = await openPicker(user);
      await user.type(input, "---");

      expect(screen.queryByText("Create")).toBeNull();
    });

    it("does not offer to create a tag the catalogue already holds", async () => {
      // It would otherwise appear twice: once as itself, once as a thing to create.
      const user = userEvent.setup();
      renderInput([]);

      const input = await openPicker(user);
      await user.type(input, "iam");

      expect(screen.queryByText("Create")).toBeNull();
    });

    it("does not offer to create a tag already selected", async () => {
      const user = userEvent.setup();
      renderInput(["payments"]);

      const input = await openPicker(user);
      await user.type(input, "payments");

      expect(screen.queryByText("Create")).toBeNull();
    });
  });

  describe("limits", () => {
    it("stops offering the picker at the server's per-secret cap", () => {
      const full = Array.from({ length: SECRET_TAG_MAX_PER_SECRET }, (_, i) => `tag-${i}`);
      renderInput(full, []);

      expect(screen.getByRole("button", { name: "Add tag" }).hasAttribute("disabled")).toBe(true);
      expect(screen.getByText(/at most 20 tags/i)).toBeTruthy();
    });

    it("says so when the catalogue is empty and nothing is typed", async () => {
      const user = userEvent.setup();
      renderInput([], []);

      await openPicker(user);

      expect(screen.getByText(/type one to create it/i)).toBeTruthy();
    });
  });
});
