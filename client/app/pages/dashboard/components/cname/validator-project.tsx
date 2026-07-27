import { LoadingButton } from "@seliseblocks/genesis-os/components";
import { useValidateCNameProject } from "@/hooks/use-project";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";

interface CnameValidatorProjectProps {
  isDomainVerified: boolean;
  cookieDomain: string;
}

export const CnameValidatorProject = ({
  isDomainVerified,
  cookieDomain,
}: CnameValidatorProjectProps) => {
  const { mutateAsync, isPending } = useValidateCNameProject({ cookieDomain });

  const handleValidate = async () => {
    try {
      if (isDomainVerified) return;
      const res = await mutateAsync();
      if (res?.isSuccess) {
        showSuccessToast({ description: "CName is validated successfully" });
      } else {
        showErrorToast({
          errors:
            res?.errors ??
            "Could not verify the domain. Please make sure it is valid and try again.",
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
      CNAME Lookup
    </LoadingButton>
  );
};
