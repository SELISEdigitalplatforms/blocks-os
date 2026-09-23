import { useMemo, useState } from "react";
import { Network, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { EmptyState } from "@/components/ui-kits/empty-state/empty-state";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { useGetDataGatewayConfigurations } from "@/cross-modules/data-gateway/hooks/use-data-gateway-configuration";
import { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import { SaveDataGatewayConfiguration } from "../data-gateway-configuration/save-data-gateway-configuration/save-data-gateway-configuration";

const SKELETON_ROWS = 3;

export function DataGatewayContents() {
  const [open, setOpen] = useState<boolean>(false);
  const [editingConfiguration, setEditingConfiguration] =
    useState<IDataGatewayConfiguration | null>(null);
  const { data, isLoading, isFetching } = useGetDataGatewayConfigurations();
  const loading = isLoading || isFetching;
  const configurations = useMemo(() => data ?? [], [data]);

  const handleAdd = () => {
    setEditingConfiguration(null);
    setOpen(true);
  };

  const handleEdit = (configuration: IDataGatewayConfiguration) => {
    setEditingConfiguration(configuration);
    setOpen(true);
  };

  return (
    <div className="flex flex-col">
      <div className="mt-2 rounded-sm border bg-card p-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Data Gateway Configurations</h2>
            <p className="text-sm text-muted-foreground">
              Per-project data source settings for the DataGateway module.
            </p>
          </div>
          <Button variant="default" size="sm" className="gap-2" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            Add Configuration
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-0">
              {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 border-b px-4 py-4 last:border-0"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="ml-auto h-7 w-7 rounded" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : configurations.length > 0 ? (
          <Card>
            <CardContent className="overflow-x-clip p-0 sm:overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Project Key</TableHead>
                    <TableHead>Database Name</TableHead>
                    <TableHead>Connection String</TableHead>
                    <TableHead>Analytics</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configurations.map((configuration) => {
                    const analyticsEnabled =
                      configuration.analyticsConfiguration?.enableAnalytics ?? false;
                    return (
                      <TableRow key={configuration.itemId}>
                        <TableCell className="font-medium">{configuration.projectKey}</TableCell>
                        <TableCell>{configuration.databaseName}</TableCell>
                        {/* The backend always masks this to "********" - it is never rendered in
                            the clear here. */}
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {configuration.connectionString}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              analyticsEnabled
                                ? "w-fit border-transparent bg-emerald-100 text-emerald-700"
                                : "w-fit border-transparent bg-muted text-muted-foreground"
                            }
                          >
                            {analyticsEnabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                aria-label="Edit configuration"
                                onClick={() => handleEdit(configuration)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Network}
            title="No DataGateway configurations yet"
            description="Add a configuration to connect a project's data source."
          />
        )}
      </div>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setEditingConfiguration(null);
        }}
      >
        <SaveDataGatewayConfiguration
          configuration={editingConfiguration ?? undefined}
          onClose={setOpen}
        />
      </Dialog>
    </div>
  );
}
