import { ServiceList } from "./service-list";
import { GuideLineWrapper } from "@blocks-identifier/components/guideline/guideline-wrapper";
import { useState } from "react";
import { myServicesGuidelineSteps } from "./guideline-docs";
interface MyServicesProps {
  guideOpen?: boolean;
  onGuideOpenChange?: (open: boolean) => void;
}
export const MyServices = ({ guideOpen, onGuideOpenChange }: MyServicesProps = {}) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const open = guideOpen !== undefined ? guideOpen : internalOpen;
  const setOpen = onGuideOpenChange || setInternalOpen;
  return (
    <>
      <ServiceList />
      <GuideLineWrapper
        title="Guideline"
        open={open}
        onOpenChange={setOpen}
        content={myServicesGuidelineSteps}
      />
    </>
  );
};
