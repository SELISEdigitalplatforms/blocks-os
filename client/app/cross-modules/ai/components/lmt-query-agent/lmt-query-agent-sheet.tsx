import { Button } from "@/components/ui-kits/button/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui-kits/sheet/sheet";
import { Bot } from "lucide-react";
import { LMTQueryAgent } from "./lmt-query-agent";
import { useState } from "react";
import { isAgentsEnabled } from "@/lib/features";
interface LMTQueryAgentSheetProps {
  agentName?: string;
  questions?: string[];
  description?: string;
}
export const LMTQueryAgentSheet = ({
  agentName = "Blocks Agent",
  questions,
  description,
}: LMTQueryAgentSheetProps) => {
  const [open, setOpen] = useState<boolean>(false);
  // The agent is served by the agents service; without it the button would only lead to errors.
  if (!isAgentsEnabled()) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen} modal={false}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Bot className="aspect-square w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-2">{agentName}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className="top-[60px] h-[calc(100vh-60px)] w-full p-0 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <LMTQueryAgent
          agentName={agentName}
          onClose={() => setOpen(false)}
          questions={questions}
          description={description}
        />
      </SheetContent>
    </Sheet>
  );
};
