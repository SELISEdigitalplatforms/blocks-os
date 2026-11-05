import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NO_SHARE,
  type ShareChoice,
} from "@blocks-communication/mail/constants/share-organizations";

const h = vi.hoisted(() => ({
  templateIds: [] as Array<string | undefined>,
  copies: new Map<string, { organizationId: string; templateId: string }>(),
  last: null as ShareChoice | null,
}));

vi.mock("@blocks-communication/mail/hooks/use-template-copy", () => ({
  useOrganizationChecklistData: (templateId?: string) => {
    h.templateIds.push(templateId);
    return {
      organizations: [
        { itemId: "acme", name: "Acme Corp" },
        { itemId: "globex", name: "Globex" },
      ],
      copies: h.copies,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
    };
  },
}));

import { ShareWithOrganizations } from "./share-with-organizations";

const Harness = ({ templateId }: { templateId?: string }) => {
  const [choice, setChoice] = useState<ShareChoice>(NO_SHARE);
  const onChange = (next: ShareChoice) => {
    h.last = next;
    setChoice(next);
  };
  return <ShareWithOrganizations choice={choice} onChange={onChange} templateId={templateId} />;
};

describe("ShareWithOrganizations (SPEC33 H7, board TemplateForm)", () => {
  beforeEach(() => {
    h.templateIds = [];
    h.copies = new Map();
    h.last = null;
  });

  it("starts with Only the Default organization and no organization list", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Share with other organizations" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Only the Default organization/ })).toHaveProperty(
      "ariaChecked",
      "true",
    );
    expect(screen.queryByRole("checkbox", { name: "Acme Corp" })).toBeNull();
  });

  it("copies to selected organizations, with keep or replace and the background note", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Copy to other organizations/ }));
    expect(
      screen.getByText(
        /The copies are made in the background after you save the Template step, so they get the finished email\./,
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Selected organizations" }));
    await user.click(screen.getByRole("checkbox", { name: "Globex" }));
    expect(screen.getByText("1 selected")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Replace it with this version" }));
    expect(h.last).toMatchObject({ copy: true, allOrganizations: false, existing: "replace" });
    expect([...(h.last?.selected.entries() ?? [])]).toEqual([["globex", "Globex"]]);
  });

  it("copies to all organizations without a list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Copy to other organizations/ }));
    await user.click(screen.getByRole("radio", { name: "All organizations" }));
    expect(screen.queryByRole("checkbox", { name: "Acme Corp" })).toBeNull();
    expect(h.last).toMatchObject({ copy: true, allOrganizations: true });
  });

  it("shows no OWN COPY markers before step 1 has saved the template (Q4: A)", async () => {
    const user = userEvent.setup();
    h.copies = new Map([["globex", { organizationId: "globex", templateId: "g-1" }]]);
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: /Copy to other organizations/ }));
    await user.click(screen.getByRole("radio", { name: "Selected organizations" }));
    expect(h.templateIds.every((id) => id === undefined)).toBe(true);
  });

  it("looks up and shows OWN COPY once the template exists", async () => {
    const user = userEvent.setup();
    h.copies = new Map([["globex", { organizationId: "globex", templateId: "g-1" }]]);
    render(<Harness templateId="d-1" />);
    await user.click(screen.getByRole("radio", { name: /Copy to other organizations/ }));
    await user.click(screen.getByRole("radio", { name: "Selected organizations" }));
    expect(h.templateIds).toContain("d-1");
    expect(screen.getByText("OWN COPY")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Globex" })).toHaveProperty("disabled", true);
  });
});
