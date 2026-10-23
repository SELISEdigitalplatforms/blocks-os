import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { Form, FormField } from "@/components/ui-kits/form/form";

const h = vi.hoisted(() => ({
  scope: { isRestricted: true, managedByCandidates: ["lead", "member"] as string[] },
  getRoles: vi.fn(),
}));

vi.mock("@blocks-idp/iam/hooks/use-grant-scope", () => ({
  useGrantScope: () => h.scope,
}));
vi.mock("@blocks-idp/iam/hooks/use-roles", () => ({
  useGetRoles: (...args: unknown[]) => h.getRoles(...args),
}));

import { ManagedBySelect } from ".";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const onChange = vi.fn();
const TRIGGER_ID = "managed-by-select";

const Harness = ({ value, excludeSlug }: { value?: string | null; excludeSlug?: string }) => {
  const form = useForm();
  return (
    <Form {...form}>
      <FormField
        name="parent"
        control={form.control}
        render={() => <ManagedBySelect value={value} onChange={onChange} excludeSlug={excludeSlug} />}
      />
    </Form>
  );
};

describe("ManagedBySelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.scope = { isRestricted: true, managedByCandidates: ["lead", "member"] };
    h.getRoles.mockReturnValue({
      data: {
        data: [
          { slug: "lead", name: "Team Lead" },
          { slug: "member", name: "Member" },
        ],
      },
    });
  });

  it("renders nothing for the system user", () => {
    h.scope = { isRestricted: false, managedByCandidates: [] };
    render(<Harness />);
    expect(screen.queryByText("Managed by")).toBeNull();
  });

  it("asks only for the roles the caller holds or manages", () => {
    render(<Harness />);
    expect(screen.getByText("Managed by")).toBeTruthy();
    expect(h.getRoles).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { slugs: ["lead", "member"] } }),
      { enabled: true },
    );
  });

  it("leaves a role out of its own choices", () => {
    render(<Harness excludeSlug="lead" />);
    expect(h.getRoles).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { slugs: ["member"] } }),
      { enabled: true },
    );
  });

  it("does not fetch names when there is nothing to choose from", () => {
    h.scope = { isRestricted: true, managedByCandidates: [] };
    render(<Harness />);
    expect(h.getRoles).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });

  it("shows the current role by name and reports a new choice", async () => {
    const user = userEvent.setup();
    render(<Harness value="lead" />);
    expect(screen.getByTestId(TRIGGER_ID).textContent).toContain("Team Lead");

    await user.click(screen.getByTestId(TRIGGER_ID));
    await user.click(await screen.findByRole("option", { name: "Member" }));
    expect(onChange).toHaveBeenCalledWith("member");
  });

  it("clears the choice with 'No one'", async () => {
    const user = userEvent.setup();
    render(<Harness value="lead" />);
    await user.click(screen.getByTestId(TRIGGER_ID));
    await user.click(await screen.findByRole("option", { name: "No one" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("still shows a parent the caller could not pick", () => {
    render(<Harness value="boss" />);
    expect(screen.getByTestId(TRIGGER_ID).textContent).toContain("boss");
  });

  it("shows the slug while the role names are still loading", () => {
    h.getRoles.mockReturnValue({ data: undefined });
    render(<Harness value="lead" />);
    expect(screen.getByTestId(TRIGGER_ID).textContent).toContain("lead");
  });
});
