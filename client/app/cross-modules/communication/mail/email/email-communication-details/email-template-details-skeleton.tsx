import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Button } from "@/components/ui-kits/button/button";
import { ArrowLeft } from "lucide-react";
export const EmailTemplateDetailsSkeleton = () => {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 md:hidden" disabled>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <Skeleton className="hidden h-7 w-64 md:block" />
          <Skeleton className="h-7 w-40 md:hidden" />
        </div>
        <Skeleton className="h-10 w-32 shrink-0" />
      </div>
      <div className="grid min-h-[34rem] min-w-0 flex-none grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.8fr)] overflow-hidden rounded-lg border border-border bg-card shadow-sm sm:min-h-[38rem] sm:grid-cols-[minmax(0,2fr)_minmax(16rem,0.9fr)] xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,0.9fr)]">
        <section className="flex min-h-[34rem] min-w-0 flex-col border-r border-border sm:min-h-[38rem] xl:min-h-0">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-10 w-20" />
          </div>
          <div className="min-h-[30rem] flex-1 animate-pulse bg-muted sm:min-h-[34rem] xl:min-h-0" />
        </section>
        <aside className="flex min-w-0 flex-col">
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
          <div className="grid gap-x-6 gap-y-7 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="space-y-2 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-full" />
            </div>
            {["language", "configuration", "created", "modified"].map((field) => (
              <div className="space-y-2" key={field}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-28" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
