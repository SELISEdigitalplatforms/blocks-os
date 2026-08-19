import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { ARCHIVE_ERROR_MESSAGES, normalizeArchiveErrors } from "../constants/archive-error-messages";

type ArchiveActionProps = {
  /** What is being archived, for the dialog copy and the button's accessible name. */
  entity: "role" | "permission";
  name: string;
  /** The per-row mutation. Instantiated by the caller *inside* the row, never hoisted. */
  archive: (id: string) => Promise<unknown>;
  isPending: boolean;
  itemId: string;
};

/**
 * Trash button plus its confirm dialog, for one row.
 *
 * Both lists render this per row so that `isPending` is scoped to the row being archived. The
 * obvious model to copy — `SignOutButton` in session-list-card — takes `mutateAsync` and
 * `isPending` as props from a single parent hook, which would make one row's archive disable every
 * other row's confirm button.
 */
export const ArchiveAction = ({
  entity,
  name,
  archive,
  isPending,
  itemId,
}: ArchiveActionProps) => {
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await archive(itemId);
      showSuccessToast({
        description: `${entity === "role" ? "Role" : "Permission"} archived successfully`,
      });
      setOpen(false);
    } catch (error) {
      // Rejections arrive thrown, never as a resolved failure, so there is no `isSuccess` branch
      // here. The dialog deliberately stays open so the reason is read next to the action.
      const dictionary =
        normalizeArchiveErrors(error) ?? (isErrorWithErrors(error) ? error.errors : undefined);

      // An empty dictionary counts as absent. The HTTP client attaches `errors: {}` to a transport
      // failure, and a plain `??` would keep it, leaving getErrorMessage to answer with its generic
      // "Something went wrong." instead of the archive-specific copy.
      const errors =
        dictionary && Object.keys(dictionary).length > 0
          ? dictionary
          : "Something went wrong while archiving.";

      // The dictionary and the map go in raw; showErrorToast runs the lookup itself. Mapping here
      // first yielded a string[], and handleErrorMessages collapses any array to "An unexpected
      // error occurred." -- so the mapped copy was computed and then discarded.
      showErrorToast({ errors, customMessages: ARCHIVE_ERROR_MESSAGES });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* DialogTrigger rather than a manual setOpen: Radix needs the trigger reference to
          return focus to this button after Cancel, Escape or a successful archive. */}
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full"
          aria-label={`Archive ${entity} ${name}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Archive this {entity}?</DialogTitle>
          <DialogDescription>
            {name} will be archived and hidden from this list. Existing records are kept, so nothing
            is permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Archiving..." : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
