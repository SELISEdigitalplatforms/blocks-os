import { Badge } from "@/components/ui-kits/badge/badge";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CopyToClipboardButton, MaskedText } from "@seliseblocks/genesis-os/components";

type ProjectOverviewProps = {
  name: string;
  environment: string;
  tenantId: string;
  isFetching?: boolean;
};

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  name,
  environment,
  tenantId,
  isFetching = false,
}) => {
  if (isFetching) {
    return <ProjectOverviewSkeleton />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
     <div className="flex items-start gap-1.5">
       <h1 className="min-w-0 break-words text-lg font-bold md:text-2xl">{name}</h1>
       <Badge className="-mt-2 shrink-0 self-start rounded-lg text-xs px-1 py-0.5 hover:bg-primary">
         {environment}
       </Badge>
     </div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
        <p className="font-semibold text-high-emphasis">{"X-Blocks-Key:"}</p>
        <CopyToClipboardButton
          className="text-high-emphasis rounded-lg items-center"
          textToCopy={tenantId || ""}
          isHoverable
        >
          <MaskedText text={tenantId || ""} showFirstN={3} showLastN={3} length={20} />
        </CopyToClipboardButton>
      </div>
    </div>
  );
};

const ProjectOverviewSkeleton = () => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-20 rounded-full -mt-2" />
      </div>

      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
};
