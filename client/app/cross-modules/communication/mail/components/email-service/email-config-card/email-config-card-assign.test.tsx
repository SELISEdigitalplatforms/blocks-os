import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Accordion } from "@/components/ui-kits/accordion/accordion";
import type { IEmailConfig } from "@blocks-communication/mail/models/email";

vi.mock("@blocks-communication/mail/hooks/use-email-config", () => ({
  useGetEmailConfigUsage: () => ({ data: 0, isLoading: false, isError: false, refetch: vi.fn() }),
}));

import { EmailConfigCard } from "./email-config-card";

const config = (over: Partial<IEmailConfig>): IEmailConfig =>
  ({
    itemId: "c1",
    name: "Acme SMTP",
    isDefault: false,
    isInbound: false,
    provider: 0,
    ...over,
  }) as IEmailConfig;

const renderCard = (over: Partial<IEmailConfig>, onAssign = vi.fn()) => {
  render(
    <Accordion type="single" collapsible>
      <EmailConfigCard
        config={config(over)}
        isFirst
        showOrganization={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onAssign={onAssign}
      />
    </Accordion>,
  );
  return onAssign;
};

const openMenu = async (name: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: `More actions for ${name}` }));
  return user;
};

describe("EmailConfigCard: Assign templates (SPEC32 H6, C1)", () => {
  it("offers Assign templates first on an outbound card", async () => {
    const onAssign = renderCard({});
    const user = await openMenu("Acme SMTP");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Assign templates", "Edit", "Delete"]);
    await user.click(items[0]);
    expect(onAssign).toHaveBeenCalled();
  });

  it("offers it on the outbound Default card too, before Edit", async () => {
    renderCard({ name: "Default", isDefault: true });
    await openMenu("Default");
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Assign templates",
      "Edit",
    ]);
  });

  it("hides it on an inbound card (C1)", async () => {
    renderCard({ name: "Acme Inbox", isInbound: true });
    await openMenu("Acme Inbox");
    expect(screen.queryByRole("menuitem", { name: "Assign templates" })).toBeNull();
  });

  it("is absent where the host offers no assign action", async () => {
    render(
      <Accordion type="single" collapsible>
        <EmailConfigCard
          config={config({})}
          isFirst
          showOrganization={false}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </Accordion>,
    );
    await openMenu("Acme SMTP");
    expect(screen.queryByRole("menuitem", { name: "Assign templates" })).toBeNull();
  });
});
