import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { forwardRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformSchema } from "./data-access.service";

const h = vi.hoisted(() => ({
  schemas: [] as PlatformSchema[],
  viewProps: [] as Array<Record<string, unknown>>,
  largeScreen: true,
}));

vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));
vi.mock("./data-access.service", () => ({
  PLATFORM_SERVICES: ["IAM", "OS", "Logic", "Release", "Monitor"],
  platformDataAccessService: { getSchemas: () => Promise.resolve({ isSuccess: true, data: h.schemas }) },
}));
// The access editor is the existing component, covered on its own; here it only has to receive the right subject.
vi.mock("./gateway/components/schema-access-control/schema-access-control-view", () => ({
  SchemaAccessControlView: forwardRef(function SchemaAccessControlView(props: Record<string, unknown>, _ref) {
    h.viewProps.push(props);
    return <div data-testid="access-editor">{`${String(props.level)}:${String(props.operation)}:${(props.fieldNames as string[]).join(",")}`}</div>;
  }),
}));

import { DataAccessPage } from "./data-access-page";

const f = (name: string, over: Partial<PlatformSchema["fields"][number]> = {}) => ({
  name,
  type: "String",
  isArray: false,
  editAccessLevel: 0,
  ...over,
});

const role: PlatformSchema = {
  id: "role-id",
  schemaName: "Role",
  collectionName: "Roles",
  service: "IAM",
  readAccessLevel: 3,
  writeAccessLevel: 3,
  editAccessLevel: 3,
  deleteAccessLevel: 3,
  fields: [
    f("ItemId"),
    f("CreatedDate", { type: "DateTime" }),
    f("Name", { description: "Role name", isPIIData: true }),
    f("Access", { type: "OperationAccess", fields: [f("Roles", { isArray: true }), f("UserIds", { isArray: true })] }),
    f("Kind", { type: "Enum", enumValues: ["System", "Custom"] }),
  ],
};

const build: PlatformSchema = {
  ...role,
  id: "build-id",
  schemaName: "Build",
  collectionName: "Builds",
  service: "Release",
  readAccessLevel: 2,
  fields: [f("ItemId"), f("Status")],
};

function renderPage(searchParams = "") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams}>
        <DataAccessPage />
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

describe("DataAccessPage", () => {
  beforeEach(() => {
    h.schemas = [role, build];
    h.viewProps = [];
    h.largeScreen = true;
    Object.defineProperty(globalThis, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes("min-width: 1024px") ? h.largeScreen : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it("lists every platform schema with its service, and filters by service and name", async () => {
    const user = userEvent.setup();
    renderPage();

    const list = await screen.findByRole("button", { name: /Role/ });
    expect(list).toBeTruthy();
    expect(screen.getByRole("button", { name: /Build/ })).toBeTruthy();

    // The service filter lives in the URL, which updates asynchronously.
    await user.click(screen.getByRole("button", { name: "Release", pressed: false }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Role/ })).toBeNull());
    expect(screen.getByRole("button", { name: /Build/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "All" }));
    await screen.findByRole("button", { name: "All", pressed: true });
    await user.type(screen.getByLabelText("Search schemas"), "rol");
    expect(screen.getByRole("button", { name: /Role/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Build/ })).toBeNull();
  });

  it("flags a schema anyone can read", async () => {
    renderPage();
    await screen.findByRole("button", { name: /Build/ });
    expect(screen.getByTitle("Anyone can read this schema")).toBeTruthy();
  });

  it("shows the selected schema's header and properties, read-only", async () => {
    renderPage("?schemaId=role-id");

    // The small-screen back bar repeats the name; jsdom does not apply the CSS that hides one of them.
    expect(await screen.findAllByRole("heading", { name: "Role" })).toHaveLength(2);
    expect(screen.getByText("Roles")).toBeTruthy();
    expect(screen.getByText("3 fields · 2 system")).toBeTruthy();
    for (const verb of ["View", "Create", "Edit", "Delete"]) {
      expect(screen.getByRole("button", { name: `${verb} Custom` })).toBeTruthy();
    }
    // Desktop table and mobile cards are both in the DOM; CSS picks one by width.
    expect(screen.getAllByText("Role name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Allowed values").length).toBeGreaterThan(0);

    // Nothing here edits, deletes, adds or publishes.
    for (const label of [/^Edit$/, /Delete schema/, /Add/, /Publish/]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    // As in the Data Gateway, every property shows Validation and Default value; with no rules for this
    // schema they are disabled and say why.
    const validation = screen.getAllByRole("button", { name: "Validation rules can't be set on Name" });
    expect(validation.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: "A default value can't be set on Name" })[0]).toHaveProperty("disabled", true);
    expect(screen.getAllByRole("button", { name: "Validations are only available for primitive types" })[0]).toHaveProperty("disabled", true);
    expect(screen.queryAllByRole("button", { name: /^Manage validations/ })).toHaveLength(0);
  });

  it("opens Validation and Default value only where the schema's rules allow, and shows Required", async () => {
    h.schemas = [
      {
        ...role,
        fields: role.fields.map((field) => (field.name === "Name" ? { ...field, requiredOn: "Insert" as const } : field)),
        rules: { level: "Normal", fields: [{ path: "Name", validation: "Allowed", default: "Blocked", defaultHasNoEffect: false }] },
      },
      build,
    ];
    renderPage("?schemaId=role-id");

    expect((await screen.findAllByRole("button", { name: "Manage validations for Name" }))[0]).toHaveProperty("disabled", false);
    expect(screen.getAllByRole("button", { name: "A default value can't be set on Name" })[0]).toHaveProperty("disabled", true);
    expect(screen.getAllByRole("button", { name: "Validation rules can't be set on Kind" })[0]).toHaveProperty("disabled", true);
    expect(screen.getAllByTitle("Required when the record is created").length).toBeGreaterThan(0);
  });

  it("keeps the default properties folded until opened", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");

    const toggle = (await screen.findAllByRole("button", { name: /Default Properties \(2\)/ }))[0];
    expect(screen.queryAllByText("ItemId")).toHaveLength(0);

    await user.click(toggle);
    expect(screen.getAllByText("ItemId").length).toBeGreaterThan(0);
  });

  it("lists the base entity's access lists among the default properties, still expandable", async () => {
    const user = userEvent.setup();
    h.schemas = [{ ...role, fields: [...role.fields, f("Read", { type: "OperationAccess", fields: [f("Permissions", { isArray: true })] })] }, build];
    renderPage("?schemaId=role-id");

    // Read counts as a default property: the group holds ItemId, CreatedDate and Read.
    const toggle = (await screen.findAllByRole("button", { name: /Default Properties \(3\)/ }))[0];
    // The group's open state is shared by every table on the page and kept between renders.
    if (toggle.getAttribute("aria-expanded") === "true") await user.click(toggle);
    expect(screen.queryAllByText("Read")).toHaveLength(0);
    const outside = screen.getAllByRole("button", { name: "Expand OperationAccess attributes" }).length;

    await user.click(toggle);
    expect(screen.getAllByText("Read").length).toBeGreaterThan(0);
    const expands = screen.getAllByRole("button", { name: "Expand OperationAccess attributes" });
    expect(expands.length).toBeGreaterThan(outside);

    for (const expand of expands) await user.click(expand);
    expect(screen.getAllByText("Permissions").length).toBeGreaterThan(0);
  });

  it("expands an object property to show what is inside", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");

    const expand = (await screen.findAllByRole("button", { name: "Expand OperationAccess attributes" }))[0];
    expect(screen.queryAllByText("UserIds")).toHaveLength(0);

    await user.click(expand);
    expect(screen.getAllByText("UserIds").length).toBeGreaterThan(0);
  });

  it("opens object properties as a tree in the same table, several at once, with Expand all and Collapse all", async () => {
    const user = userEvent.setup();
    const owner = f("Owner", { type: "Person", fields: [f("Email"), f("Address", { type: "Address", fields: [f("City")] })] });
    h.schemas = [{ ...role, fields: [...role.fields, owner] }, build];
    renderPage("?schemaId=role-id");

    const table = (await screen.findAllByText("Owner")).map((name) => name.closest("table")).find(Boolean) as HTMLElement;
    expect(within(table).getAllByText("2 fields")).toHaveLength(2);

    await user.click(within(table).getByRole("button", { name: "Expand OperationAccess attributes" }));
    await user.click(within(table).getByRole("button", { name: "Expand Person attributes" }));
    expect(within(table).getByText("UserIds")).toBeTruthy();
    expect(within(table).getByText("Email")).toBeTruthy();
    expect(within(table).queryByText("City")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(within(table).getByText("City").closest("tr")?.dataset.treeDepth).toBe("2");

    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(within(table).queryByText("UserIds")).toBeNull();
    expect(within(table).queryByText("Email")).toBeNull();
  });

  it("opens schema access on the verb that was clicked, with all four operations", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");
    await screen.findAllByRole("heading", { name: "Role" });

    await user.click(screen.getByRole("button", { name: "View Custom" }));
    const inspector = await screen.findByRole("complementary", { name: "Access for Role" });
    expect(within(inspector).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["View", "Create", "Edit", "Delete"]);
    expect(within(inspector).getByRole("tab", { selected: true }).textContent).toBe("View");
    // One editor per operation (READ 0, CREATE 1, UPDATE 2, DELETE 3), each seeded with that operation's level.
    expect(within(inspector).getAllByTestId("access-editor").map((e) => e.textContent)).toEqual(["row:0:", "row:1:", "row:2:", "row:3:"]);
    expect(h.viewProps.at(-4)).toMatchObject({ schemaId: "role-id", operation: 0, defaultAccessLevel: 3 });

    await user.click(screen.getByRole("button", { name: "Delete Custom" }));
    expect(within(inspector).getByRole("tab", { selected: true }).textContent).toBe("Delete");
  });

  it("opens a nested property's access with its full path, for View and Edit only", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");

    await user.click((await screen.findAllByRole("button", { name: "Expand OperationAccess attributes" }))[0]);
    await user.click(screen.getAllByRole("button", { name: "View access for Access.Roles" })[0]);

    const inspector = await screen.findByRole("complementary", { name: "Access for Access.Roles" });
    expect(within(inspector).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["View", "Edit"]);
    expect(within(inspector).getAllByTestId("access-editor").map((e) => e.textContent)).toEqual(["column:0:Access.Roles", "column:2:Access.Roles"]);
  });

  it("does not offer access on an object property itself", async () => {
    renderPage("?schemaId=role-id");
    await screen.findAllByRole("heading", { name: "Role" });
    expect(screen.getAllByRole("button", { name: "Set access on the properties inside" })[0]).toHaveProperty("disabled", true);
  });

  it("opens the access inspector as a sheet on small screens", async () => {
    h.largeScreen = false;
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");
    await screen.findAllByRole("heading", { name: "Role" });

    await user.click(screen.getByRole("button", { name: "Schema Access" }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getAllByTestId("access-editor")).toHaveLength(4);
  });

  it("previews the schema structure as JSON", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");
    await screen.findAllByRole("heading", { name: "Role" });

    await user.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(screen.getByText("Role preview")).toBeTruthy());
    expect(document.body.textContent).toContain('"UserIds"');
  });

  describe("validation rules and default values", () => {
    const withRules: PlatformSchema = {
      ...role,
      rules: {
        level: "Warned",
        fields: [
          { path: "Name", validation: "Allowed", default: "Blocked", defaultHasNoEffect: false },
          { path: "Create.Roles", validation: "Warned", default: "Warned", defaultHasNoEffect: false },
        ],
      },
    };

    it("shows no rule buttons while rules are off (no flags in the schema list)", async () => {
      renderPage("?schemaId=role-id");
      await screen.findAllByText("Name");
      expect(screen.queryByRole("button", { name: /Manage validations for/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Default value for/ })).toBeNull();
    });

    it("offers only what the allow-list opens, and asks first on a warned schema", async () => {
      const user = userEvent.setup();
      h.schemas = [withRules, build];
      renderPage("?schemaId=role-id");
      await screen.findAllByText("Name");

      // Name takes validations but no default; ItemId takes neither.
      expect(screen.getAllByRole("button", { name: "Manage validations for Name" }).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "Default value for Name" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Manage validations for ItemId" })).toBeNull();

      await user.click(screen.getAllByRole("button", { name: "Manage validations for Name" })[0]);
      const column = screen.getByTestId("inspector-column");
      expect(within(column).getByRole("alert").textContent).toContain("Role is used by sign-in and the console");
      expect(within(column).queryByRole("button", { name: /Add validation/ })).toBeNull();

      await user.click(within(column).getByRole("button", { name: "I understand, continue" }));
      expect(within(column).getByRole("button", { name: /Add validation/ })).toBeTruthy();
    });

    it("opens validations and the default value on the base entity's access lists, inside the tree", async () => {
      const user = userEvent.setup();
      const create = f("Create", { type: "OperationAccess", fields: [f("Roles", { isArray: true }), f("UserIds", { isArray: true })] });
      h.schemas = [{ ...withRules, fields: [...withRules.fields, create] }, build];
      renderPage("?schemaId=role-id");

      const toggle = (await screen.findAllByRole("button", { name: /Default Properties/ }))[0];
      if (toggle.getAttribute("aria-expanded") !== "true") await user.click(toggle);
      for (const expand of screen.getAllByRole("button", { name: "Expand OperationAccess attributes" })) await user.click(expand);

      expect(screen.getAllByRole("button", { name: "Manage validations for Create.Roles" })[0]).toHaveProperty("disabled", false);
      expect(screen.getAllByRole("button", { name: "Default value for Create.Roles" })[0]).toHaveProperty("disabled", false);
      expect(screen.getAllByRole("button", { name: "Validation rules can't be set on Create.UserIds" })[0]).toHaveProperty("disabled", true);
    });

    it("offers Bulk rules only while rules are on", async () => {
      renderPage();
      await screen.findAllByText("Role");
      expect(screen.queryByRole("button", { name: "Bulk rules" })).toBeNull();
    });

    it("opens Bulk rules for default properties", async () => {
      const user = userEvent.setup();
      h.schemas = [withRules, build];
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Bulk rules" }));
      expect(await screen.findByRole("dialog", { name: "Bulk rules for default properties" })).toBeTruthy();
    });

    it("says so on every property of a schema kept out of rules", async () => {
      h.schemas = [withRules, build];
      renderPage("?schemaId=build-id");

      const reason = "Build doesn't take validation rules or default values: credentials, tokens, sessions, secrets and logs are kept out";
      expect((await screen.findAllByRole("button", { name: reason })).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: "Validation rules can't be set on Status" })).toBeNull();
    });
  });
});

