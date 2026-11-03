import { ServiceList } from "./service-list";
import { GuideLineWrapper } from "@blocks-identifier/components/guideline/guideline-wrapper";
import { useState } from "react";
import { getMyServicesGuidelineSteps } from "./guideline-docs";
import { useT } from "@seliseblocks/genesis-os";
interface MyServicesProps {
  guideOpen?: boolean;
  onGuideOpenChange?: (open: boolean) => void;
}
export const MyServices = ({ guideOpen, onGuideOpenChange }: MyServicesProps = {}) => {
  const { t } = useT("os.identifier");
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const open = guideOpen !== undefined ? guideOpen : internalOpen;
  const setOpen = onGuideOpenChange || setInternalOpen;
  return (
    <>
      <ServiceList />
      <GuideLineWrapper
        title={t("MY_SERVICES.GUIDELINE")}
        open={open}
        onOpenChange={setOpen}
        content={getMyServicesGuidelineSteps(t)}
      />
    </>
  );
};
