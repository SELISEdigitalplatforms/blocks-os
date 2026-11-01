import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { useDisableProject } from "@/hooks/use-project";
import { isErrorWithErrors } from "@seliseblocks/genesis-os/utils";
import { useProjectStore } from "@seliseblocks/genesis-os/store";
import { Archive } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { Button } from "@/components/ui-kits/button/button";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { useT } from "@seliseblocks/genesis-os";

export const ArchiveProject = () => {
  const { t } = useT("os.dashboard");
  const navigate = useNavigate();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useDisableProject({ projectKey });
  const onClickHandler = async () => {
    try {
      const res = await mutateAsync();
      if (res.isSuccess) {
        showSuccessToast({
          title: t("ARCHIVE.ENVIRONMENT_DELETED"),
          description: t("ARCHIVE.ENVIRONMENT_DELETED_SUCCESSFULLY"),
        });
        navigate("/app/console");
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };
  const [open, setOpen] = useState<boolean>(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="flex items-center gap-2">
          <Archive className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">{t("common:DELETE")}</span>
        </Button>
      </DialogTrigger>
      <ConfirmationModal
        onCancel={() => setOpen(false)}
        onConfirm={onClickHandler}
        data={{
          dialogTitle: t("ARCHIVE.DELETE_THIS_ENVIRONMENT"),
          dialogSubtitle: (
            <>
              <p>{t("ARCHIVE.ARE_YOU_SURE_YOU_WANT")}</p>
              <p>
                {t("ARCHIVE.THIS_WILL_PERMANENTLY_DELETE_THE")}
              </p>
            </>
          ),
          confirmButton: t("common:DELETE"),
        }}
        buttonState={{ confirm: { disable: isPending } }}
      />
    </Dialog>
  );
};
