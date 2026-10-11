import { useCallback, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, Loader2, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { useCards } from "@blocks-identifier/hooks/use-billing";
import { IPaymentMethodView } from "@blocks-identifier/models/billing.model";
import { AddCardDialog } from "./add-card-dialog";
import { LoadError, LoadingRows, day, errorText, touch } from "./billing-ui";
import { useNewCardPoll } from "./use-new-card-poll";

/**
 * The cards this project pays with.
 *
 * Route: /app/project/:tenantGroupId/billing/cards. Cards belong to the project (decided
 * 2026-10-11), so every owner of the project sees and manages the same list.
 *
 * Blocks never holds a card number: the provider form takes it and Blocks keeps only a token in
 * the vault, plus brand, last four and expiry for display.
 */

const outlineButton = cn(
  touch,
  "inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-high-emphasis hover:bg-accent disabled:opacity-50",
);
const primaryButton = cn(
  touch,
  "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50",
);

const expiry = (card: IPaymentMethodView) =>
  `${String(card.expiryMonth).padStart(2, "0")} / ${card.expiryYear}`;

const POLL_TEXT = {
  idle: null,
  waiting: "Waiting for the payment provider to confirm the card…",
  found: "Card added.",
  timeout:
    "The card has not appeared yet. The provider may still be confirming it — check again in a minute.",
} as const;

export function CardsPage() {
  const { tenantGroupId } = useParams();
  const { data: cards, loading, error, reload, setDefault, remove } = useCards(tenantGroupId);

  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<IPaymentMethodView | null>(null);

  const poll = useNewCardPoll(tenantGroupId, reload);
  const { start: startPoll } = poll;

  const knownIds = (cards ?? []).map((card) => card.paymentMethodId);
  const knownKey = knownIds.join(",");

  // Stable, so AddCardDialog does not re-open the provider form on every render.
  const onCompleted = useCallback(() => {
    startPoll(knownKey ? knownKey.split(",") : []);
  }, [startPoll, knownKey]);

  if (!tenantGroupId) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-high-emphasis">No project selected</p>
          <p className="mt-1 text-sm text-medium-emphasis">
            Cards belong to a project. Open one to see them.
          </p>
        </div>
      </div>
    );
  }

  const makeDefault = async (card: IPaymentMethodView) => {
    setBusyId(card.paymentMethodId);
    setActionError(null);
    try {
      await setDefault(card.paymentMethodId);
    } catch (caught) {
      setActionError(errorText(caught, "The default card could not be changed."));
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const card = removing;
    setBusyId(card.paymentMethodId);
    setActionError(null);
    try {
      await remove(card.paymentMethodId);
      setRemoving(null);
    } catch (caught) {
      setActionError(errorText(caught, "The card could not be removed."));
      setRemoving(null);
    } finally {
      setBusyId(null);
    }
  };

  const list = cards ?? [];
  const onlyCard = list.length === 1;
  const pollText = POLL_TEXT[poll.status];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link
          to=".."
          relative="path"
          aria-label="Back to billing"
          className={cn(
            touch,
            "inline-flex items-center gap-1 font-medium text-medium-emphasis hover:text-high-emphasis",
          )}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Billing
        </Link>
        <span className="text-low-emphasis" aria-hidden="true">
          /
        </span>
        <span className="text-high-emphasis" aria-current="page">
          Cards
        </span>
      </nav>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">Cards</h1>
          <p className="text-sm text-medium-emphasis">
            The cards this project pays with. The default one is charged at each renewal.
          </p>
        </div>
        <button type="button" className={primaryButton} onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a card
        </button>
      </header>

      <div className="flex gap-3 rounded-lg border border-blocks-primary-100 bg-blocks-primary-25 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blocks-primary-700" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-high-emphasis">
            The card number never reaches Blocks
          </p>
          <p className="text-[13px] text-medium-emphasis">
            It goes from your browser to the payment provider, which returns a token standing for
            the card. Blocks keeps only that token, in a vault, plus the brand, last four digits and
            expiry you see here.
          </p>
        </div>
      </div>

      {pollText && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 text-sm",
            poll.status === "timeout" ? "text-warning-800" : "text-medium-emphasis",
          )}
        >
          {poll.status === "waiting" && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {pollText}
        </p>
      )}

      {actionError && (
        <p role="alert" className="text-sm text-red-700">
          {actionError}
        </p>
      )}

      {error ? (
        <LoadError message="The cards could not be loaded." onRetry={() => void reload()} />
      ) : loading && !cards ? (
        <LoadingRows label="Loading cards" />
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-high-emphasis">No card on this project yet</p>
          <p className="mt-1 text-sm text-medium-emphasis">
            A renewal needs a card, so add one before the next charge.
          </p>
        </div>
      ) : (
        <section aria-label="Cards on file" className="rounded-lg border border-border bg-card">
          <div
            className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_auto] gap-3 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-low-emphasis md:grid"
            aria-hidden="true"
          >
            <span>Card</span>
            <span>Expires</span>
            <span>Added</span>
            <span>Last charged</span>
            <span className="w-52" />
          </div>
          <ul className="flex flex-col">
            {list.map((card) => (
              <li
                key={card.paymentMethodId}
                className={cn(
                  "flex flex-col gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0 md:grid md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] md:items-center md:gap-3",
                  card.isDefault && "bg-blocks-primary-25",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-10 shrink-0 items-center justify-center rounded bg-high-emphasis text-[8px] font-bold uppercase tracking-wide text-white">
                    {card.brand.slice(0, 4)}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-medium text-high-emphasis">
                      •••• {card.lastFour}
                    </span>
                    {card.isDefault && (
                      <span className="rounded bg-blocks-primary-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-blocks-primary-700">
                        default
                      </span>
                    )}
                    {card.isExpired && (
                      <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-warning-800">
                        expired
                      </span>
                    )}
                  </span>
                </div>
                <span className="font-mono text-medium-emphasis">
                  <span className="text-xs md:hidden">Expires </span>
                  {expiry(card)}
                </span>
                <span className="text-medium-emphasis">
                  <span className="text-xs md:hidden">Added </span>
                  {day(card.createdAtUtc)}
                </span>
                <span className="text-medium-emphasis">
                  <span className="text-xs md:hidden">Last charged </span>
                  {day(card.lastChargedAtUtc)}
                </span>
                <div className="flex gap-2 md:w-52 md:justify-end">
                  {!card.isDefault && (
                    <button
                      type="button"
                      className={outlineButton}
                      onClick={() => void makeDefault(card)}
                      disabled={busyId !== null}
                      aria-label={`Make the card ending ${card.lastFour} the default`}
                    >
                      Make default
                    </button>
                  )}
                  <button
                    type="button"
                    className={outlineButton}
                    onClick={() => setRemoving(card)}
                    disabled={busyId !== null}
                    aria-label={`Remove the card ending ${card.lastFour}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length > 0 && (
        <p className="text-sm text-medium-emphasis">
          {list.length} {list.length === 1 ? "card" : "cards"} on file. The default is charged at
          each renewal; the others are only used if you pick one at checkout.
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-high-emphasis">Removing the default card</p>
        <p className="mt-1 text-[13px] text-medium-emphasis">
          Another card becomes the default in its place, because a renewal needs one. A card cannot
          be edited — add a new one and make it the default.
        </p>
      </div>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setRemoving(null);
        }}
      >
        {removing && (
          <ConfirmationModal
            data={{
              dialogTitle: `Remove the card ending ${removing.lastFour}?`,
              dialogSubtitle: onlyCard
                ? "This is the only card on this project. Renewals need a card, so the next charge will not go through until you add another."
                : removing.isDefault
                  ? "This is the default card. Another card on this project becomes the default and is charged at the next renewal."
                  : "It will no longer be offered for payments on this project. Past invoices still name it.",
              confirmButton: busyId ? "Removing…" : "Remove",
              cancelButton: "Keep it",
            }}
            onCancel={() => setRemoving(null)}
            onConfirm={() => void confirmRemove()}
            buttonState={{ confirm: { disable: busyId !== null } }}
          />
        )}
      </Dialog>

      <AddCardDialog
        tenantGroupId={tenantGroupId}
        open={adding}
        onOpenChange={setAdding}
        onCompleted={onCompleted}
      />
    </div>
  );
}
