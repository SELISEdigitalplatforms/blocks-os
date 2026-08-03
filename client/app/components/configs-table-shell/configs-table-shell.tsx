import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { cn } from "@/lib/utils";

type ConfigsTableShellProps = {
  title?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer: React.ReactNode;
  bodyMinHeightClass?: string;
  children: React.ReactNode;
};

export const ConfigsTableShell = ({
  title,
  toolbar,
  footer,
  bodyMinHeightClass = "min-h-[280px]",
  children,
}: ConfigsTableShellProps) => {
  const hasHeader = !!title || !!toolbar;
  return (
    <Card>
      {hasHeader ? (
        <CardHeader className={cn(title ? "flex flex-col gap-4" : undefined)}>
          {title ? <CardTitle>{title}</CardTitle> : null}
          {toolbar}
        </CardHeader>
      ) : null}
      <CardContent className="flex flex-col p-0">
        <div className={cn("flex flex-1 flex-col px-6", bodyMinHeightClass)}>{children}</div>
        <div className="mt-auto flex items-center justify-end border-t px-6 py-4">{footer}</div>
      </CardContent>
    </Card>
  );
};
