import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  options: undefined as
    undefined | { page: number; pageSize: number; search?: string; enabled?: boolean },
  responses: new Map<string, unknown>(),
  byIdLookups: [] as string[],
  byId: new Map<string, unknown>(),
}));

vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizations: (options: {
    page: number;
    pageSize: number;
    search?: string;
    enabled?: boolean;
  }) => {
    h.options = options;
    const key = `${options.page}:${options.search ?? ""}`;
    return {
      data: options.enabled ? h.responses.get(key) : undefined,
      isLoading: false,
      isFetching: false,
      isPlaceholderData: false,
    };
  },
  useGetOrganizationById: ({ itemId }: { itemId: string; projectKey: string }) => {
    h.byIdLookups.push(itemId);
    return { data: itemId ? h.byId.get(itemId) : undefined };
  },
}));

import { OrganizationCombobox } from "./organization-combobox";

const organization = (index: number) => ({
  itemId: `org-${index}`,
  name: `Organization ${index}`,
  isDisabled: false,
});

describe("OrganizationCombobox", () => {
  beforeEach(() => {
    h.options = undefined;
    h.responses.clear();
    h.byIdLookups = [];
    h.byId.clear();
  });

  it("debounces search and sends it to the organizations query", async () => {
    h.responses.set("0:", {
      organizations: [organization(1)],
      totalCount: 1,
    });
    h.responses.set("0:Beta", {
      organizations: [{ ...organization(2), name: "Beta" }],
      totalCount: 1,
    });

    const user = userEvent.setup();
    render(<OrganizationCombobox projectKey="tenant-1" value="" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("Search organizations..."), "Beta");

    await waitFor(() => expect(h.options?.search).toBe("Beta"), { timeout: 1500 });
    expect(h.options).toMatchObject({ page: 0, pageSize: 10, enabled: true });
    expect(await screen.findByRole("option", { name: "Beta" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Organization 1" })).toBeNull();
  });

  it("loads and appends the next page near the bottom of the list", async () => {
    h.responses.set("0:", {
      organizations: Array.from({ length: 10 }, (_, index) => organization(index + 1)),
      totalCount: 11,
    });
    h.responses.set("1:", {
      organizations: [organization(11)],
      totalCount: 11,
    });

    const user = userEvent.setup();
    render(<OrganizationCombobox projectKey="tenant-1" value="" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    const list = await screen.findByTestId("organization-options-list");
    Object.defineProperties(list, {
      scrollTop: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 100 },
    });
    fireEvent.scroll(list);

    await waitFor(() => expect(h.options?.page).toBe(1));
    expect(await screen.findByRole("option", { name: "Organization 11" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Organization 1" })).toBeTruthy();
  });

  it("keeps existing memberships visible with a green check on the right", async () => {
    h.responses.set("0:", {
      organizations: [organization(1), organization(2)],
      totalCount: 2,
    });
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(
      <OrganizationCombobox
        projectKey="tenant-1"
        value="org-1"
        onValueChange={onValueChange}
        preselectedOrganizationIds={new Set(["org-1"])}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const existingOption = await screen.findByRole("option", { name: "Organization 1" });
    expect(existingOption.getAttribute("aria-selected")).toBe("true");
    expect(existingOption.getAttribute("aria-disabled")).toBe("true");
    expect(existingOption.querySelector(".text-green-600")).not.toBeNull();

    await user.click(existingOption);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "Organization 2" })).toBeTruthy();
  });

  it("hides not-enabled organizations only when excludeNotEnabled is set", async () => {
    h.responses.set("0:", {
      organizations: [
        organization(1),
        { ...organization(2), isEnable: false },
        { ...organization(3), isDisabled: true },
      ],
      totalCount: 3,
    });
    const user = userEvent.setup();
    const { unmount } = render(
      <OrganizationCombobox projectKey="tenant-1" value="" onValueChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Default",
      "Organization 1",
      "Organization 2",
    ]);
    unmount();

    render(
      <OrganizationCombobox
        projectKey="tenant-1"
        value=""
        onValueChange={vi.fn()}
        excludeNotEnabled
      />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Default",
      "Organization 1",
    ]);
  });

  it("shows the raw id when the saved organization is not listed", () => {
    render(
      <OrganizationCombobox
        projectKey="tenant-1"
        value="org-gone"
        onValueChange={vi.fn()}
        excludeNotEnabled
      />,
    );
    expect(screen.getByRole("combobox").textContent).toContain("org-gone");
  });

  it("looks up the saved organization by id and shows its name", () => {
    h.byId.set("org-sales", { organization: { itemId: "org-sales", name: "Sales" } });
    render(
      <OrganizationCombobox projectKey="tenant-1" value="org-sales" onValueChange={vi.fn()} />,
    );
    expect(h.byIdLookups).toContain("org-sales");
    expect(screen.getByRole("combobox").textContent).toContain("Sales");
  });

  it("skips the by-id lookup for Default, an empty value, or a name already known", () => {
    render(<OrganizationCombobox projectKey="tenant-1" value="default" onValueChange={vi.fn()} />);
    render(<OrganizationCombobox projectKey="tenant-1" value="" onValueChange={vi.fn()} />);
    render(
      <OrganizationCombobox
        projectKey="tenant-1"
        value="org-1"
        initialSelectedName="Organization 1"
        onValueChange={vi.fn()}
      />,
    );
    expect(h.byIdLookups.every((itemId) => itemId === "")).toBe(true);
  });

  it("stops looking up once the user picks an option", async () => {
    h.responses.set("0:", { organizations: [organization(2)], totalCount: 1 });
    h.byId.set("org-1", { organization: { itemId: "org-1", name: "Organization 1" } });
    const Controlled = () => {
      const [value, setValue] = useState("org-1");
      return <OrganizationCombobox projectKey="tenant-1" value={value} onValueChange={setValue} />;
    };
    const user = userEvent.setup();
    render(<Controlled />);
    expect(screen.getByRole("combobox").textContent).toContain("Organization 1");

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Organization 2" }));
    expect(screen.getByRole("combobox").textContent).toContain("Organization 2");
    expect(h.byIdLookups.at(-1)).toBe("");
  });
});
