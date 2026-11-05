import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { OrganizationChecklistData } from "@blocks-communication/mail/hooks/use-template-copy";
import { OrganizationChecklist } from "./organization-checklist";

const data = (over: Partial<OrganizationChecklistData> = {}): OrganizationChecklistData => ({
  organizations: [
    { itemId: "acme", name: "Acme Corp" },
    { itemId: "umbrella", name: "Umbrella Ltd" },
    { itemId: "wayne", name: "Wayne Enterprises" },
  ],
  copies: new Map([
    ["umbrella", { organizationId: "umbrella", templateId: "u-1" }],
    ["wayne", { organizationId: "wayne", templateId: "w-1" }],
  ]),
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  hasNextPage: false,
  fetchNextPage: vi.fn(),
  isFetchingNextPage: false,
  copiesLoading: false,
  copiesError: false,
  refetchCopies: vi.fn(),
  ...over,
});

const Harness = ({
  initial = new Map<string, string>(),
  onChange = vi.fn(),
  checklistData = data(),
}: {
  initial?: ReadonlyMap<string, string>;
  onChange?: (selected: ReadonlyMap<string, string>) => void;
  checklistData?: OrganizationChecklistData;
}) => {
  const [selected, setSelected] = useState(initial);
  return (
    <OrganizationChecklist
      mode="delete"
      idPrefix="delete-organization"
      data={checklistData}
      existing="keep"
      selected={selected}
      onSelectedChange={(next) => {
        setSelected(next);
        onChange(next);
      }}
    />
  );
};

describe("OrganizationChecklist in delete mode (SPEC34 H7, board DeleteTemplateDefault)", () => {
  it("disables organizations without a copy and says there is nothing to delete", () => {
    render(<Harness />);
    const acme = screen.getByRole("checkbox", { name: "Acme Corp" });
    expect(acme).toHaveProperty("disabled", true);
    expect(screen.getByText("No copy · nothing to delete")).toBeTruthy();
    expect(screen.getAllByText("OWN COPY")).toHaveLength(2);
  });

  it("says a ticked copy is deleted and an unticked one is kept", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("checkbox", { name: "Umbrella Ltd" }));
    expect(screen.getByText("Deletes their copy")).toBeTruthy();
    expect(screen.getByText("Keeps their copy")).toBeTruthy();
    expect(screen.getByText("1 selected")).toBeTruthy();
  });

  it("selects only organizations that have a copy with Select all", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect([...onChange.mock.calls.at(-1)![0].keys()]).toEqual(["umbrella", "wayne"]);
    expect(screen.getByText("2 selected")).toBeTruthy();
  });

  it("drops a picked organization that turns out to have no copy", () => {
    const onChange = vi.fn();
    render(<Harness initial={new Map([["acme", "Acme Corp"]])} onChange={onChange} />);
    expect([...onChange.mock.calls.at(-1)![0].keys()]).toEqual([]);
    expect(screen.getByText("0 selected")).toBeTruthy();
  });
});
