import { LoadingButton } from "@seliseblocks/genesis-os/components";
import { useValidateCNameProject } from "@/hooks/use-project";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { useT } from "@seliseblocks/genesis-os";

interface CnameValidatorProjectProps {
  isDomainVerified: boolean;
  cookieDomain: string;
}

export const CnameValidatorProject = ({
  isDomainVerified,
  cookieDomain,
}: CnameValidatorProjectProps) => {
  const { t } = useT("os.dashboard");
  const { mutateAsync, isPending } = useValidateCNameProject({ cookieDomain });

  const handleValidate = async () => {
    try {
      if (isDomainVerified) return;
      const res = await mutateAsync();
      if (res?.isSuccess) {
        showSuccessToast({ description: t("VALIDATOR_PROJECT.CNAME_IS_VALIDATED_SUCCESSFULLY") });
      } else {
        showErrorToast({
          errors: res?.errors ?? t("VALIDATOR_PROJECT.COULD_NOT_VERIFY_THE_DOMAIN"),
        });
      }
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <LoadingButton
      onClick={handleValidate}
      disabled={isPending || isDomainVerified}
      isLoading={isPending}
    >
      {t("VALIDATOR_PROJECT.CNAME_LOOKUP")}
    </LoadingButton>
  );
};
