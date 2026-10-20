import { Button } from "@/components/ui-kits/button/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui-kits/dialog/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { Shield } from "lucide-react";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { PlatformSchemaField } from "../data-access.service";
import { AccessTierDot, PanelHeader, PanelShell } from "../gateway/components/primitives";
import {
  SchemaAccessControlView,
  type SchemaAccessControlViewHandle,
} from "../gateway/components/schema-access-control/schema-access-control-view";
import { PERMISSION_ACTIONS, TAB_TO_ACCESS_LEVEL_KEY, TAB_TO_OPERATION } from "../gateway/constants/schema-access-control";

/** View, Create, Edit or Delete, as the inspector's tab ids. */
export type AccessTab = "view" | "create" | "edit" | "delete";

/** The four levels of the schema (row) or the property (column). */
export type AccessLevels = {
  readAccessLevel?: number;
  writeAccessLevel?: number;
  editAccessLevel?: number;
  deleteAccessLevel?: number;
};

export interface AccessInspectorTarget extends AccessLevels {
  /** Heading: the schema name, or the property being inspected. */
  subject: string;
  /** Second line, e.g. "Field on Role". */
  context: string;
  schemaId: string;
  schemaName: string;
  fields: PlatformSchemaField[];
  level: "row" | "column";
  fieldNames: string[];
  /** The tab to open on, e.g. the access pill that was clicked. */
  tab?: AccessTab;
}

/** Whether the inspector holds unsaved changes, and how to save or discard them. */
export interface AccessInspectorHandle {
  isDirty: () => boolean;
  save: () => Promise<boolean>;
  discard: () => void;
}

/**
 * Services apply property rules for View and Edit only (Genesis derives column
 * rules for READ and EDIT), so a property shows those two tabs; the schema shows all four.
 */
export const tabsForLevel = (level: AccessInspectorTarget["level"]) =>
  level === "column" ? PERMISSION_ACTIONS.filter((a) => a.value === "view" || a.value === "edit") : PERMISSION_ACTIONS;

/**
 * The Data Gateway's docked access inspector: one tab per verb, each with its
 * tier dot and the access editor for that operation. All tabs stay mounted, so
 * unsaved changes on one survive switching to another.
 */
export const AccessInspector = forwardRef<AccessInspectorHandle, { target: AccessInspectorTarget; onClose: () => void }>(
  function AccessInspector({ target, onClose }, ref) {
    const tabs = tabsForLevel(target.level);
    const requestedTab = tabs.some((t) => t.value === target.tab) ? (target.tab as string) : "view";
    const [activeTab, setActiveTab] = useState(requestedTab);
    const tabRefs = useRef<Record<string, SchemaAccessControlViewHandle | null>>({});

    // Another pill clicked while open: land on its verb. Adjusted during render so the old tab never paints.
    const [lastTarget, setLastTarget] = useState(target);
    if (target !== lastTarget) {
      setLastTarget(target);
      setActiveTab(requestedTab);
    }

    useImperativeHandle(ref, () => ({
      isDirty: () => Object.values(tabRefs.current).some((handle) => handle?.isDirty),
      save: async () => {
        for (const handle of Object.values(tabRefs.current)) {
          if (handle?.isDirty && !(await handle.save())) return false;
        }
        return true;
      },
      discard: () => Object.values(tabRefs.current).forEach((handle) => handle?.discard()),
    }));

    return (
      <PanelShell label={`Access for ${target.subject}`}>
        <PanelHeader icon={Shield} title={target.subject} subtitle={target.context} onClose={onClose} closeLabel="Close access inspector" />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border/40 px-3">
            <TabsList className="flex h-12 w-full gap-0.5 bg-transparent p-0">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.value}
                  className="flex h-12 flex-1 flex-col items-center justify-center gap-1.5 rounded-none border-b-2 border-transparent px-2.5 py-2.5 text-xs text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  <span>{tab.label}</span>
                  <AccessTierDot level={target[TAB_TO_ACCESS_LEVEL_KEY[tab.value]]} />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.value}
              forceMount
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 data-[state=inactive]:hidden"
            >
              <SchemaAccessControlView
                ref={(handle) => {
                  tabRefs.current[tab.value] = handle;
                }}
                schemaFields={target.fields}
                schemaName={target.schemaName}
                schemaId={target.schemaId}
                level={target.level}
                operation={TAB_TO_OPERATION[tab.value]}
                fieldNames={target.fieldNames}
                defaultAccessLevel={target[TAB_TO_ACCESS_LEVEL_KEY[tab.value]]}
              />
            </TabsContent>
          ))}
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
