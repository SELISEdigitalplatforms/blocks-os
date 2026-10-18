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
  PLATFORM_SERVICES: ["IAM", "OS", "Logic", "Release"],
  platformDataAccessService: { getSchemas: () => Promise.resolve({ isSuccess: true, data: h.schemas }) },
}));
// The access editor is the existing component, covered on its own; here it only has to receive the right subject.
vi.mock("./gateway/components/schema-access-control/schema-access-control-view", () => ({
  SchemaAccessControlView: forwardRef(function SchemaAccessControlView(props: Record<string, unknown>, _ref) {
    h.viewProps.push(props);
    return <div data-testid="access-editor">{`${String(props.level)}:${(props.fieldNames as string[]).join(",")}`}</div>;
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
    f("Create", { type: "OperationAccess", fields: [f("Roles", { isArray: true }), f("UserIds", { isArray: true })] }),
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

    await user.click(screen.getByRole("button", { name: "Release", pressed: false }));
    expect(screen.queryByRole("button", { name: /^Role/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Build/ })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "All" }));
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

    // Nothing here edits, deletes, adds, validates or publishes.
    for (const label of [/^Edit$/, /Delete schema/, /Add/, /validation/i, /Publish/]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("keeps the default properties folded until opened", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");

    const toggle = (await screen.findAllByRole("button", { name: /Default Properties \(2\)/ }))[0];
    expect(screen.queryAllByText("ItemId")).toHaveLength(0);

    await user.click(toggle);
    expect(screen.getAllByText("ItemId").length).toBeGreaterThan(0);
  });

  it("expands an object property to show what is inside", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");

    const expand = (await screen.findAllByRole("button", { name: "Expand OperationAccess attributes" }))[0];
    expect(screen.queryAllByText("UserIds")).toHaveLength(0);

    await user.click(expand);
    expect(screen.getAllByText("UserIds").length).toBeGreaterThan(0);
  });

  it("opens schema access on Edit only", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");
    await screen.findAllByRole("heading", { name: "Role" });

    await user.click(screen.getByRole("button", { name: "View Custom" }));
    expect(screen.queryByTestId("access-editor")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit Custom" }));
    expect((await screen.findByTestId("access-editor")).textContent).toBe("row:");
    expect(h.viewProps.at(-1)).toMatchObject({ schemaId: "role-id", operation: 2, defaultAccessLevel: 3 });
  });

  it("opens a nested property's access with its full path", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");

    await user.click((await screen.findAllByRole("button", { name: "Expand OperationAccess attributes" }))[0]);
    await user.click(screen.getAllByRole("button", { name: "View access for Create.Roles" })[0]);

    const inspector = await screen.findByRole("complementary", { name: "Access for Create.Roles" });
    expect(within(inspector).getByTestId("access-editor").textContent).toBe("column:Create.Roles");
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
    expect(within(sheet).getByTestId("access-editor").textContent).toBe("row:");
  });

  it("previews the schema structure as JSON", async () => {
    const user = userEvent.setup();
    renderPage("?schemaId=role-id");
    await screen.findAllByRole("heading", { name: "Role" });

    await user.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => expect(screen.getByText("Role preview")).toBeTruthy());
    expect(document.body.textContent).toContain('"UserIds"');
  });
});
