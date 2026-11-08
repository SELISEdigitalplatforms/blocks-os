import { useRemoveMagicUrl } from "./use-magic-url";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.utilities";

export const useDeactivateMagicUrl = () => {
  const queryClient = useQueryClient();
  const { mutate: removeMagicUrl, isPending: isRemoving } = useRemoveMagicUrl();

  const deactivateMagicUrl = (itemId: string, projectKey: string, onSuccess?: () => void) => {
    removeMagicUrl(
      { linkIds: [itemId], projectKey },
      {
        onSuccess: () => {
          toast({
            variant: "success",
            title: tStatic(I18N_MODULE, "common:SUCCESS"),
            description: tStatic(
              I18N_MODULE,
              "USE_DEACTIVATE_MAGIC_URL.MAGIC_URL_DEACTIVATED_SUCCESSFULLY",
            ),
          });
          queryClient.invalidateQueries({ queryKey: ["magic-url", itemId] });
          onSuccess?.();
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: tStatic(I18N_MODULE, "common:ERROR"),
            description: tStatic(
              I18N_MODULE,
              "USE_DEACTIVATE_MAGIC_URL.FAILED_TO_DEACTIVATE_MAGIC_URL",
            ),
          });
        },
      },
    );
  };

  return { deactivateMagicUrl, isRemoving };
};
