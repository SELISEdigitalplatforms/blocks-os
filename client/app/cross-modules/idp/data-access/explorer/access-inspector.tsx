import { Button } from "@/components/ui-kits/button/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui-kits/dialog/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { Shield } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { AccessTierDot, PanelHeader, PanelShell } from "../gateway/components/primitives";
import {
  SchemaAccessControlView,
  type SchemaAccessControlViewHandle,
} from "../gateway/components/schema-access-control/schema-access-control-view";
import { POLICY_OPERATION } from "../gateway/constants/schema-access-control";

export interface AccessInspectorTarget {
  /** Heading: the schema name, or the property being inspected. */
  subject: string;
  /** Second line, e.g. "Field on Role". */
  context: string;
  schemaId: string;
  schemaName: string;
  fields: PlatformSchemaField[];
  level: "row" | "column";
  fieldNames: string[];
  /** The current Edit level of the schema (row) or the property (column). */
  editAccessLevel?: number;
}

/** Whether the inspector holds unsaved changes, and how to save or discard them. */
export interface AccessInspectorHandle {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}

/**
 * The Data Gateway's docked access inspector, limited to the one verb platform
 * schemas support here: Edit (update). Same tab strip, tier dot and editor.
 */
export const AccessInspector = forwardRef<AccessInspectorHandle, { target: AccessInspectorTarget; onClose: () => void }>(
  function AccessInspector({ target, onClose }, ref) {
    const viewRef = useRef<SchemaAccessControlViewHandle | null>(null);

    useImperativeHandle(ref, () => ({
      isDirty: () => Boolean(viewRef.current?.isDirty),
      save: async () => (viewRef.current?.isDirty ? viewRef.current.save() : true),
      discard: () => viewRef.current?.discard(),
    }));

    return (
      <PanelShell label={`Access for ${target.subject}`}>
        <PanelHeader icon={Shield} title={target.subject} subtitle={target.context} onClose={onClose} closeLabel="Close access inspector" />
        <Tabs value="edit" className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border/40 px-3">
            <TabsList className="flex h-12 w-full gap-0.5 bg-transparent p-0">
              <TabsTrigger
                value="edit"
                className="flex h-12 flex-1 flex-col items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent px-2.5 py-2.5 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                <span>Edit</span>
                <AccessTierDot level={target.editAccessLevel} />
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="edit" className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3">
            <SchemaAccessControlView
              ref={viewRef}
              schemaFields={target.fields}
              schemaName={target.schemaName}
              schemaId={target.schemaId}
              level={target.level}
              operation={POLICY_OPERATION.UPDATE}
              fieldNames={target.fieldNames}
              defaultAccessLevel={target.editAccessLevel}
            />
          </TabsContent>
        </Tabs>
      </PanelShell>
    );
  },
);

/** Asked before closing or switching the inspector while it holds unsaved changes. */
export function UnsavedAccessChangesDialog({
  onSave,
  onDiscard,
  isSaving,
}: Readonly<{ onSave: () => void; onDiscard: () => void; isSaving?: boolean }>) {
  return (
    <DialogContent
      className="mr-4 w-full max-w-[425px] rounded-md"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        document.body.style.pointerEvents = "";
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-left text-lg font-semibold leading-7">Save changes?</DialogTitle>
        <DialogDescription className="mb-2 mt-2 wrap-break-word text-left text-sm font-normal leading-5">
          This access rule has unsaved changes. Save them before leaving, or discard them.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-4 flex flex-row justify-end gap-2">
        <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDiscard} disabled={isSaving}>
          Discard
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isSaving}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
