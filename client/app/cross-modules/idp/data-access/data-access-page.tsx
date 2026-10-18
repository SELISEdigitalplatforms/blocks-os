import { PageHeader } from "@/components/page-header/page-header";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui-kits/sheet/sheet";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { platformDataAccessService, type PlatformSchema, type PlatformSchemaField } from "./data-access.service";
import {
  AccessInspector,
  UnsavedAccessChangesDialog,
  type AccessInspectorHandle,
  type AccessInspectorTarget,
  type AccessTab,
} from "./explorer/access-inspector";
import { useDataAccessSearchParams, useIsLargeScreen, useLingeringValue } from "./explorer/explorer-hooks";
import { MOTION, SHELL } from "./explorer/explorer-utils";
import { SchemaExplorer, SchemaRail, filterSchemas } from "./explorer/schema-explorer";
import { SchemaFieldsTable, SchemaFieldsTableSkeleton, type OnOpenFieldAccess } from "./explorer/schema-fields-table";
import { SchemaHeader, SchemaHeaderSkeleton } from "./explorer/schema-header";
import { SchemaPreviewDrawer } from "./explorer/schema-preview-drawer";

const inspectorKey = (target: AccessInspectorTarget) => `${target.schemaId}:${target.level}:${target.fieldNames.join(",")}`;

/** Inspector subject for the schema itself (row access), opened on `tab`. */
const schemaAccessTarget = (schema: PlatformSchema, tab?: AccessTab): AccessInspectorTarget => ({
  subject: schema.schemaName,
  context: "Schema access",
  schemaId: schema.id,
  schemaName: schema.schemaName,
  fields: schema.fields,
  level: "row",
  fieldNames: [],
  tab,
  readAccessLevel: schema.readAccessLevel,
  writeAccessLevel: schema.writeAccessLevel,
  editAccessLevel: schema.editAccessLevel,
  deleteAccessLevel: schema.deleteAccessLevel,
});

/** Inspector subject for one property (column access), addressed by its dotted path. */
const fieldAccessTarget = (schema: PlatformSchema, path: string, field: PlatformSchemaField): AccessInspectorTarget => ({
  subject: path,
  context: `Field on ${schema.schemaName}`,
  schemaId: schema.id,
  schemaName: schema.schemaName,
  fields: schema.fields,
  level: "column",
  fieldNames: [path],
  readAccessLevel: field.readAccessLevel,
  editAccessLevel: field.editAccessLevel,
});

/** Header plus property table for the selected schema, or a placeholder while loading or when none is selected. */
function SchemaPanel({
  isLoading,
  schema,
  isAccessPanelOpen,
  onOpenPreview,
  onOpenSchemaAccess,
  onOpenFieldAccess,
}: Readonly<{
  isLoading: boolean;
  schema: PlatformSchema | null;
  isAccessPanelOpen: boolean;
  onOpenPreview: () => void;
  onOpenSchemaAccess: (tab?: AccessTab) => void;
  onOpenFieldAccess: OnOpenFieldAccess;
}>) {
  if (isLoading) {
    return (
      <>
        <SchemaHeaderSkeleton />
        <SchemaFieldsTableSkeleton />
      </>
    );
  }
  if (!schema) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <h4 className="text-lg font-semibold">Schema</h4>
          <p className="text-sm text-muted-foreground">Select a schema from the list to view its properties and access.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <SchemaHeader schema={schema} isAccessPanelOpen={isAccessPanelOpen} onOpenPreview={onOpenPreview} onOpenSchemaAccess={onOpenSchemaAccess} />
      <SchemaFieldsTable schemaName={schema.schemaName} fields={schema.fields} onOpenFieldAccess={onOpenFieldAccess} />
    </>
  );
}

/**
 * One layer of a column that cross-fades with another in the same slot; the hidden
 * layer is inert so it cannot take focus or clicks.
 */
function FadeLayer({ visible, className, children }: Readonly<{ visible: boolean; className: string; children: ReactNode }>) {
  return (
    <div aria-hidden={!visible} inert={!visible} style={{ opacity: visible ? 1 : 0 }} className={cn("dg-fade-layer", !visible && "pointer-events-none", className)}>
      {children}
    </div>
  );
}

/**
 * The docked inspector column. Its width is the animated part; the panel inside
 * is pinned to the right edge at full width, so closing clips it rather than
 * squeezing it.
 */
function InspectorColumn({
  isOpen,
  inspector,
  lingeringInspector,
  inspectorRef,
  onClose,
}: Readonly<{
  isOpen: boolean;
  inspector: AccessInspectorTarget | null;
  lingeringInspector: AccessInspectorTarget | null;
  inspectorRef: RefObject<AccessInspectorHandle | null>;
  onClose: () => void;
}>) {
  const style = {
    "--dg-inspector-w": `${isOpen ? SHELL.inspectorWidthExpanded : 0}px`,
    "--dg-inspector-panel-w": `${SHELL.inspectorWidthExpanded}px`,
    opacity: isOpen ? 1 : 0,
  } as CSSProperties;

  return (
    <div
      data-testid="inspector-column"
      data-open={isOpen ? "true" : "false"}
      aria-hidden={!isOpen}
      style={style}
      className={cn("dg-panel-collapse relative hidden min-h-0 shrink-0 overflow-hidden lg:block lg:w-(--dg-inspector-w)", !isOpen && "pointer-events-none")}
    >
      {lingeringInspector && (
        <FadeLayer visible={Boolean(inspector)} className="absolute inset-y-0 right-0 flex min-h-0 w-(--dg-inspector-panel-w)">
          <AccessInspector key={inspectorKey(lingeringInspector)} ref={inspectorRef} target={lingeringInspector} onClose={onClose} />
        </FadeLayer>
      )}
    </div>
  );
}

/**
 * Data Access: the Data Gateway's Schemas tab for the platform's own schemas
 * (IAM, OS, Logic, Release), read-only except for access. Explorer on the
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
    setInspector(null);
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

  const explorerStyle = {
    "--dg-explorer-w": `${explorerWidth}px`,
    "--dg-explorer-open-w": `${SHELL.explorerWidth}px`,
    "--dg-rail-w": `${SHELL.railWidth}px`,
  } as CSSProperties;

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8rem)] lg:min-h-0">
      <PageHeader title="Data Access" description="Platform collections of IAM, OS, Logic and Release, and who may view, create, edit and delete them." />

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:items-stretch">
        {/* Explorer column: one box whose width moves between the full list and the rail. */}
        <div
          data-testid="explorer-column"
          data-collapsed={isRightPanelOpen ? "true" : "false"}
          style={explorerStyle}
          className={cn("dg-panel-collapse relative shrink-0 overflow-hidden lg:w-(--dg-explorer-w)", selectedSchemaId ? "hidden lg:block" : "block")}
        >
          <FadeLayer visible={!isRightPanelOpen} className="h-full w-full lg:w-(--dg-explorer-open-w)">
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
          </FadeLayer>
          <FadeLayer visible={isRightPanelOpen} className="absolute inset-y-0 left-0 hidden w-(--dg-rail-w) lg:block">
            <SchemaRail
              schemas={filterSchemas(schemas, queryParams.service, search)}
              selectedSchemaId={selectedSchemaId}
              onSelectSchema={selectSchema}
              onExpand={closeInspector}
            />
          </FadeLayer>
        </div>

        {/* Main content */}
        <div className={cn("flex w-full min-w-0 flex-col lg:h-full lg:flex-1 lg:overflow-hidden", selectedSchemaId ? "flex" : "hidden lg:flex")}>
          <div className="flex min-w-0 items-center gap-2 pb-2 lg:hidden">
            <button type="button" aria-label="Back to schema list" onClick={() => selectSchema(null)}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="min-w-0 truncate text-lg font-semibold">{selectedSchema?.schemaName}</h2>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <SchemaPanel
              isLoading={schemasQuery.isLoading}
              schema={selectedSchema}
              isAccessPanelOpen={isRightPanelOpen}
              onOpenPreview={() => setIsPreviewOpen(true)}
              onOpenSchemaAccess={(tab) => selectedSchema && openInspector(schemaAccessTarget(selectedSchema, tab))}
              onOpenFieldAccess={({ path, field }) => selectedSchema && openInspector(fieldAccessTarget(selectedSchema, path, field))}
            />
          </div>
        </div>

        {isLargeScreen && (
          <InspectorColumn
            isOpen={isRightPanelOpen}
            inspector={inspector}
            lingeringInspector={lingeringInspector}
            inspectorRef={inspectorRef}
            onClose={closeInspector}
          />
        )}
      </div>

      {!isLargeScreen && (
        <Sheet open={Boolean(inspector)} onOpenChange={(open) => !open && closeInspector()}>
          <SheetContent side="right" hideClose className="flex w-full flex-col p-0 sm:max-w-[540px]">
            <SheetTitle className="sr-only">Access</SheetTitle>
            <SheetDescription className="sr-only">Who may view, create, edit or delete this schema or property.</SheetDescription>
            {inspector && <AccessInspector key={inspectorKey(inspector)} ref={inspectorRef} target={inspector} onClose={closeInspector} />}
          </SheetContent>
        </Sheet>
      )}

      {selectedSchema && (
        <SchemaPreviewDrawer schemaName={selectedSchema.schemaName} fields={selectedSchema.fields} open={isPreviewOpen} onOpenChange={setIsPreviewOpen} />
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
