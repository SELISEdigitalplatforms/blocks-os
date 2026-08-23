import { Button } from "@/components/ui-kits/button/button";
import { useGetProject } from "@/hooks/use-project";
import { Rocket } from "lucide-react";
import { useState } from "react";
import { OnboardDialog } from "./onboard-dialog";

/**
 * Opens the ready-to-paste onboarding brief for the selected project. Reads the
 * project from the same cached query the overview page uses, so it costs no
 * extra request and needs no props threaded through `ProjectActions`.
 */
export const OnboardProject = () => {
  const [open, setOpen] = useState(false);
  const { data } = useGetProject();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Rocket className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Onboard</span>
      </Button>
      <OnboardDialog open={open} onOpenChange={setOpen} project={data?.data} />
    </>
  );
};
