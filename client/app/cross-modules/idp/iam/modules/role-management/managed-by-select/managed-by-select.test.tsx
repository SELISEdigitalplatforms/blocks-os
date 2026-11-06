import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { Form, FormField } from "@/components/ui-kits/form/form";

const h = vi.hoisted(() => ({
  scope: {
    scope: { isSystemUser: false } as { isSystemUser: boolean; isTopUser?: boolean } | undefined,
    isDescendant: true,
    managedByCandidates: ["lead", "member"] as string[],
  },
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
const LABEL = "Managed by";

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
    h.scope = { scope: { isSystemUser: false }, isDescendant: true, managedByCandidates: ["lead", "member"] };
    h.getRoles.mockReturnValue({
      data: {
        data: [
          { slug: "lead", name: "Team Lead" },
          { slug: "member", name: "Member" },
        ],
      },
    });
  });

  it("renders nothing until the grant scope has loaded", () => {
    h.scope = { scope: undefined, isDescendant: false, managedByCandidates: [] };
    render(<Harness />);
    expect(screen.queryByText(LABEL)).toBeNull();
  });

  describe("for the system user", () => {
    beforeEach(() => {
      h.scope = { scope: { isSystemUser: true }, isDescendant: false, managedByCandidates: [] };
    });

    it("shows the field and asks for every role of the organization", () => {
      render(<Harness />);
      expect(screen.getByText(LABEL)).toBeTruthy();
      expect(h.getRoles).toHaveBeenCalledWith(
        expect.objectContaining({ filter: { search: "" } }),
        { enabled: true },
      );
    });

    it("offers every role except the role itself", async () => {
      const user = userEvent.setup();
      render(<Harness excludeSlug="lead" />);
      await user.click(screen.getByTestId(TRIGGER_ID));
      expect(screen.getByRole("option", { name: "Member" })).toBeTruthy();
      expect(screen.queryByRole("option", { name: "Team Lead" })).toBeNull();
    });
  });

  describe("for a top user", () => {
    beforeEach(() => {
      h.scope = { scope: { isSystemUser: false, isTopUser: true }, isDescendant: false, managedByCandidates: [] };
    });

    it("asks for every role and offers 'No one' (standalone)", async () => {
      const user = userEvent.setup();
      render(<Harness value="lead" />);
      expect(h.getRoles).toHaveBeenCalledWith(
        expect.objectContaining({ filter: { search: "" } }),
        { enabled: true },
      );
      await user.click(screen.getByTestId(TRIGGER_ID));
      await user.click(await screen.findByRole("option", { name: "No one" }));
      expect(onChange).toHaveBeenCalledWith("");
    });
  });

  it("asks a descendant only for its power roles and the roles below them", () => {
    render(<Harness />);
    expect(screen.getByText(LABEL)).toBeTruthy();
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
    h.scope = { scope: { isSystemUser: false }, isDescendant: true, managedByCandidates: [] };
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

  it("never offers a descendant 'No one': its role must sit below its own", async () => {
    const user = userEvent.setup();
    render(<Harness value="lead" />);
    await user.click(screen.getByTestId(TRIGGER_ID));
    expect(screen.queryByRole("option", { name: "No one" })).toBeNull();
  });

  it("starts a descendant's empty choice on its first own role", () => {
    render(<Harness value="" />);
    expect(onChange).toHaveBeenCalledWith("lead");
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
