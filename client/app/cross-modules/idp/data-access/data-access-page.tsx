import { PageHeader } from "@/components/page-header/page-header";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui-kits/sheet/sheet";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { platformDataAccessService } from "./data-access.service";
import { AccessInspector, UnsavedAccessChangesDialog, type AccessInspectorHandle, type AccessInspectorTarget } from "./explorer/access-inspector";
import { useDataAccessSearchParams, useIsLargeScreen, useLingeringValue } from "./explorer/explorer-hooks";
import { MOTION, SHELL } from "./explorer/explorer-utils";
import { SchemaExplorer, SchemaRail, filterSchemas } from "./explorer/schema-explorer";
import { SchemaFieldsTable, SchemaFieldsTableSkeleton } from "./explorer/schema-fields-table";
import { SchemaHeader, SchemaHeaderSkeleton } from "./explorer/schema-header";
import { SchemaPreviewDrawer } from "./explorer/schema-preview-drawer";

/**
 * Data Access: the Data Gateway's Schemas tab for the platform's own schemas
 * (IAM, OS, Logic, Release), read-only except for Edit access. Explorer on the
 * left, schema in the middle, access inspector docked on the right; the explorer
 * folds to a rail while the inspector is open.
 */
export function DataAccessPage() {
  const schemasQuery = useQuery({ queryKey: ["platform-data-access-schemas"], queryFn: platformDataAccessService.getSchemas });
  const schemas = useMemo(() => schemasQuery.data?.data ?? [], [schemasQuery.data?.data]);

  const [queryParams, setQueryParams] = useDataAccessSearchParams();
  const [search, setSearch] = useState("");
  const selectedSchemaId = queryParams.schemaId;
  const selectedSchema = schemas.find((schema) => schema.id === selectedSchemaId) ?? null;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [inspector, setInspector] = useState<AccessInspectorTarget | null>(null);
  // Docked beside the table on large screens; a sheet over it below that.
  const isLargeScreen = useIsLargeScreen();
  const isRightPanelOpen = Boolean(inspector) && isLargeScreen;
  const lingeringInspector = useLingeringValue(inspector, MOTION.panel);
  const explorerWidth = isRightPanelOpen ? SHELL.railWidth : SHELL.explorerWidth;
  const inspectorWidth = isRightPanelOpen ? SHELL.inspectorWidthExpanded : 0;

  const inspectorRef = useRef<AccessInspectorHandle>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [isResolvingUnsaved, setIsResolvingUnsaved] = useState(false);

  /** Runs `action` unless the inspector holds unsaved changes, in which case it asks first. */
  const guarded = useCallback((action: () => void) => {
    if (inspectorRef.current?.isDirty()) {
      setPendingAction(() => action);
      return;
    }
    action();
  }, []);

  const closeInspector = useCallback(() => guarded(() => setInspector(null)), [guarded]);
  const openInspector = useCallback((target: AccessInspectorTarget) => guarded(() => setInspector(target)), [guarded]);

  const selectSchema = useCallback(
    (schemaId: string | null) => guarded(() => void setQueryParams({ schemaId }, { history: "push" })),
    [guarded, setQueryParams],
  );

  // Access shown for the previous schema would be wrong, so the inspector closes as the selection moves.
  const [inspectedSchemaId, setInspectedSchemaId] = useState(selectedSchemaId);
  if (inspectedSchemaId !== selectedSchemaId) {
    setInspectedSchemaId(selectedSchemaId);
    if (inspector) setInspector(null);
  }

  const handleSaveUnsaved = async () => {
    setIsResolvingUnsaved(true);
    const ok = await inspectorRef.current?.save();
    setIsResolvingUnsaved(false);
    if (!ok) return;
    pendingAction?.();
    setPendingAction(null);
  };

  const handleDiscardUnsaved = () => {
    inspectorRef.current?.discard();
    pendingAction?.();
    setPendingAction(null);
  };

  const openSchemaAccess = () => {
    if (!selectedSchema) return;
    openInspector({
      subject: selectedSchema.schemaName,
      context: "Schema access",
      schemaId: selectedSchema.id,
      schemaName: selectedSchema.schemaName,
      fields: selectedSchema.fields,
      level: "row",
      fieldNames: [],
      editAccessLevel: selectedSchema.editAccessLevel,
    });
  };

  const schemaPanel = schemasQuery.isLoading ? (
    <>
      <SchemaHeaderSkeleton />
      <SchemaFieldsTableSkeleton />
    </>
  ) : selectedSchema ? (
    <>
      <SchemaHeader
        schema={selectedSchema}
        isAccessPanelOpen={isRightPanelOpen}
        onOpenPreview={() => setIsPreviewOpen(true)}
        onOpenSchemaAccess={openSchemaAccess}
      />
      <SchemaFieldsTable
        schemaName={selectedSchema.schemaName}
        fields={selectedSchema.fields}
        onOpenFieldAccess={({ path, field }) =>
          openInspector({
            subject: path,
            context: `Field on ${selectedSchema.schemaName}`,
            schemaId: selectedSchema.id,
            schemaName: selectedSchema.schemaName,
            fields: selectedSchema.fields,
            level: "column",
            fieldNames: [path],
            editAccessLevel: field.editAccessLevel,
          })
        }
      />
    </>
  ) : (
    <Card className="w-full">
      <CardContent className="p-4">
        <h4 className="text-lg font-semibold">Schema</h4>
        <p className="text-sm text-muted-foreground">Select a schema from the list to view its properties and access.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8rem)] lg:min-h-0">
      <PageHeader title="Data Access" description="Platform collections of IAM, OS, Logic and Release, and who may update them." />

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
        {/* Explorer column: one box whose width moves between the full list and the rail. */}
        <div
          data-testid="explorer-column"
          data-collapsed={isRightPanelOpen ? "true" : "false"}
          style={
            {
              "--dg-explorer-w": `${explorerWidth}px`,
              "--dg-explorer-open-w": `${SHELL.explorerWidth}px`,
              "--dg-rail-w": `${SHELL.railWidth}px`,
            } as React.CSSProperties
          }
          className={`dg-panel-collapse relative shrink-0 overflow-hidden lg:w-(--dg-explorer-w) ${selectedSchemaId ? "hidden lg:block" : "block"}`}
        >
          <div
            aria-hidden={isRightPanelOpen}
            inert={isRightPanelOpen}
            style={{ opacity: isRightPanelOpen ? 0 : 1 }}
            className={`dg-fade-layer h-full w-full lg:w-(--dg-explorer-open-w) ${isRightPanelOpen ? "pointer-events-none" : ""}`}
          >
            <SchemaExplorer
              schemas={schemas}
              isLoading={schemasQuery.isLoading}
              service={queryParams.service}
              search={search}
              selectedSchemaId={selectedSchemaId}
              onServiceChange={(service) => void setQueryParams({ service }, { history: "push" })}
              onSearchChange={setSearch}
              onSelectSchema={selectSchema}
            />
          </div>
          <div
            aria-hidden={!isRightPanelOpen}
            inert={!isRightPanelOpen}
            style={{ opacity: isRightPanelOpen ? 1 : 0 }}
            className={`dg-fade-layer absolute inset-y-0 left-0 hidden w-(--dg-rail-w) lg:block ${isRightPanelOpen ? "" : "pointer-events-none"}`}
          >
            <SchemaRail
              schemas={filterSchemas(schemas, queryParams.service, search)}
              selectedSchemaId={selectedSchemaId}
              onSelectSchema={selectSchema}
              onExpand={closeInspector}
            />
          </div>
        </div>

        {/* Main content */}
        <div className={`flex w-full min-w-0 flex-col lg:h-full lg:flex-1 lg:overflow-hidden ${selectedSchemaId ? "flex" : "hidden lg:flex"}`}>
          <div className="flex min-w-0 items-center gap-2 pb-2 lg:hidden">
            <button type="button" aria-label="Back to schema list" onClick={() => selectSchema(null)}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="min-w-0 truncate text-lg font-semibold">{selectedSchema?.schemaName}</h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{schemaPanel}</div>
        </div>

        {/* Docked inspector column */}
        <div
          data-testid="inspector-column"
          data-open={isRightPanelOpen ? "true" : "false"}
          aria-hidden={!isRightPanelOpen}
          style={
            {
              "--dg-inspector-w": `${inspectorWidth}px`,
              "--dg-inspector-panel-w": `${SHELL.inspectorWidthExpanded}px`,
              opacity: isRightPanelOpen ? 1 : 0,
            } as React.CSSProperties
          }
          className={`dg-panel-collapse relative hidden min-h-0 shrink-0 overflow-hidden lg:block lg:w-(--dg-inspector-w) ${isRightPanelOpen ? "" : "pointer-events-none"}`}
        >
          {isLargeScreen && lingeringInspector && (
            <div
              aria-hidden={!inspector}
              inert={!inspector}
              style={{ opacity: inspector ? 1 : 0 }}
              className={`dg-fade-layer absolute inset-y-0 right-0 flex min-h-0 w-(--dg-inspector-panel-w) ${inspector ? "" : "pointer-events-none"}`}
            >
              <AccessInspector
                key={`${lingeringInspector.schemaId}:${lingeringInspector.level}:${lingeringInspector.fieldNames.join(",")}`}
                ref={inspectorRef}
                target={lingeringInspector}
                onClose={closeInspector}
              />
            </div>
          )}
        </div>
      </div>

      {!isLargeScreen && (
        <Sheet open={Boolean(inspector)} onOpenChange={(open) => !open && closeInspector()}>
          <SheetContent side="right" hideClose className="flex w-full flex-col p-0 sm:max-w-[540px]">
            <SheetTitle className="sr-only">Access</SheetTitle>
            <SheetDescription className="sr-only">Who may update this schema or property.</SheetDescription>
            {inspector && (
              <AccessInspector
                key={`${inspector.schemaId}:${inspector.level}:${inspector.fieldNames.join(",")}`}
                ref={inspectorRef}
                target={inspector}
                onClose={closeInspector}
              />
            )}
          </SheetContent>
        </Sheet>
      )}

      {selectedSchema && (
        <SchemaPreviewDrawer
          schemaName={selectedSchema.schemaName}
          fields={selectedSchema.fields}
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
        />
      )}

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        {pendingAction && (
          <UnsavedAccessChangesDialog onSave={() => void handleSaveUnsaved()} onDiscard={handleDiscardUnsaved} isSaving={isResolvingUnsaved} />
        )}
      </Dialog>
    </div>
  );
}
