import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

type ConfigLoadingStateProps = {
  fieldCount?: number;
};

export const ConfigLoadingState = ({ fieldCount = 6 }: ConfigLoadingStateProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-y-8 lg:grid-cols-3">
    {Array.from({ length: fieldCount }).map((_item, index) => (
      <div key={index} className="flex flex-col gap-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-full" />
      </div>
    ))}
  </div>
);
