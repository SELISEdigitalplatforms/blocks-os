"use client";

import { Button } from "@/components/ui-kits/button/button";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { StatusSnackbar } from "../gateway/components/primitives";
import { useSetPlatformFieldDefault } from "../gateway/hooks/use-configuration";
import { useTransientStatus } from "../gateway/hooks/use-transient-status";
import type { DefaultValueKind, IFieldDefaultValue } from "./rules.types";
import { isRefusal, serverMessage } from "./server-message";
import type { VariableField } from "./variable-syntax";
import {
  allowedDefaultKinds,
  checkDefaultDraft,
  defaultFromDraft,
  draftFromDefault,
  emptyDefaultDraft,
  formatDefaultSummary,
  type DefaultDraft,
} from "./default-value.util";
import { AUTH_NAMES } from "./variable-syntax";
import { ItemsEditor, KindPicker, LABEL_CLASS, OffsetInputs, itemsHeading, templateVariables, type DraftItem } from "./default-value-fields";

export interface DefaultValuePanelProps {
  /** The property; a nested one by its full dotted path, e.g. Read.Roles. */
  fieldName: string;
  schemaId: string;
  /** The schema's name and properties, for templates like {{EmailTemplate.Name}}. */
  variables: { schemaName: string; fields: Record<string, VariableField> };
  fieldType: string;
  isArray: boolean;
  enumValues?: string[];
  /** The default as the schema response had it; null when none. */
  initialDefault?: IFieldDefaultValue | null;
}

const KIND_HINTS: Record<DefaultValueKind, string> = {
  Static: "Stored as typed when the service creates a record with this property empty (null). Date-times are UTC.",
  Template: "Text built from other properties of the same record and the signed-in user. Missing values become empty text.",
  Now: "The time the record is created (UTC), optionally shifted.",
};

/**
 * The draft and the stable keys of its items (rows are added and removed, so their position is no key),
 * with the edits the panel makes. Every edit marks the draft touched and drops a server refusal.
 */
function useDefaultDraft(initialDefault: IFieldDefaultValue | null, kinds: DefaultValueKind[], onEdit: () => void) {
  const counter = useRef(0);
  const newKey = () => `item-${counter.current++}`;
  const [draft, setDraft] = useState<DefaultDraft>(() => {
    const start = draftFromDefault(initialDefault);
    return kinds.includes(start.kind) ? start : emptyDefaultDraft(kinds[0]);
  });
  // The first rows get fixed keys; rows added later take the counter's, which only event handlers touch.
  const [keys, setKeys] = useState<string[]>(() => draft.items.map((_, i) => `initial-${i}`));

  const edit = (next: DefaultDraft, nextKeys: string[] = keys) => {
    setDraft(next);
    setKeys(nextKeys);
    onEdit();
  };

  return {
    draft,
    keys,
    reset: (kind: DefaultValueKind) => {
      setDraft(emptyDefaultDraft(kind));
      setKeys([newKey()]);
    },
    setKind: (kind: DefaultValueKind) => edit(emptyDefaultDraft(kind), [newKey()]),
    setOffset: (offset: DefaultDraft["offset"]) => edit({ ...draft, offset }),
    setItem: (index: number, text: string) => edit({ ...draft, items: draft.items.map((item, i) => (i === index ? text : item)) }),
    addItem: () => edit({ ...draft, items: [...draft.items, ""] }, [...keys, newKey()]),
    removeItem: (index: number) => {
      const items = draft.items.filter((_, i) => i !== index);
      const rest = keys.filter((_, i) => i !== index);
      edit({ ...draft, items: items.length > 0 ? items : [""] }, rest.length > 0 ? rest : [newKey()]);
    },
  };
}

/** The rows on screen: none for Now, every item for a list, the first one otherwise. */
function visibleItems(draft: DefaultDraft, keys: string[], isArray: boolean): DraftItem[] {
  if (draft.kind === "Now") return [];
  const rows = draft.items.map((text, i) => ({ text, key: keys[i] ?? `item-extra-${text}` }));
  return isArray ? rows : rows.slice(0, 1);
}

/**
 * The default value of one property: a fixed value, a template, or Now ± an offset. Used on insert when
 * the property isn't sent. Shared by the docked inspector and the drawer, like the validation panel.
 */
export function DefaultValuePanel({
  fieldName,
  schemaId,
  variables,
  fieldType,
  isArray,
  enumValues = [],
  initialDefault = null,
}: Readonly<DefaultValuePanelProps>) {
  const kinds = allowedDefaultKinds(fieldType, isArray);
  // What's stored now: the schema response's value, then whatever this panel last saved.
  const [saved, setSaved] = useState<IFieldDefaultValue | null>(initialDefault);
  const [touched, setTouched] = useState(false);
  // A server refusal shows where the syntax errors do, until the draft changes.
  const [serverError, setServerError] = useState<string | null>(null);
  // Which template item the insert buttons write into.
  const [activeItem, setActiveItem] = useState(0);
  const { status, setSuccess, setError } = useTransientStatus();
  const { mutateAsync: setFieldDefault, isPending } = useSetPlatformFieldDefault();
  const editor = useDefaultDraft(initialDefault, kinds, () => {
    setTouched(true);
    setServerError(null);
  });
  const { draft } = editor;

  const target = { fieldType, isArray, enumValues, schemaName: variables.schemaName, fields: variables.fields };
  // Template references need the schema's fields; until they load only the syntax is checked server-side.
  const draftError = draft.kind === "Template" && !variables.schemaName ? null : checkDefaultDraft(draft, target);
  const shownError = serverError ?? (touched ? draftError : null);
  const payload = draftError ? null : defaultFromDraft(draft, target);
  const isDirty = JSON.stringify(payload) !== JSON.stringify(saved);

  const insertVariable = (variable: string) => {
    const index = Math.min(activeItem, draft.items.length - 1);
    const current = draft.items[index] ?? "";
    const spacer = current && !current.endsWith(" ") ? " " : "";
    editor.setItem(index, `${current}${spacer}${variable}`);
  };

  const save = async (value: IFieldDefaultValue | null) => {
    try {
      await setFieldDefault({ schemaId, fieldName, defaultValue: value });
      setSaved(value);
      setServerError(null);
      if (value === null) {
        editor.reset(kinds[0]);
        setTouched(false);
      }
      setSuccess(value === null ? "Default value cleared" : "Default value saved");
    } catch (error) {
      if (isRefusal(error)) setServerError(serverMessage(error));
      else setError(serverMessage(error));
    }
  };

  const handleSave = () => {
    setTouched(true);
    if (draftError || !payload) return;
    void save(payload);
  };

  return (
    <>
      <ScrollArea className="relative flex-1 overflow-auto">
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1.5">
            <p className={LABEL_CLASS}>Current default</p>
            <p className={cn("break-all text-sm", saved ? "font-mono text-foreground" : "text-muted-foreground")}>
              {saved ? formatDefaultSummary(saved) : "None"}
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-sm border border-border/40 bg-card p-4">
            <KindPicker kinds={kinds} value={draft.kind} hint={KIND_HINTS[draft.kind]} onChange={editor.setKind} />

            {draft.kind === "Now" ? (
              <OffsetInputs
                offset={draft.offset}
                invalid={Boolean(shownError)}
                summary={payload ? formatDefaultSummary(payload) : null}
                onChange={editor.setOffset}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <span className={LABEL_CLASS}>{itemsHeading(isArray, draft.kind)}</span>
                <ItemsEditor
                  items={visibleItems(draft, editor.keys, isArray)}
                  isTemplate={draft.kind === "Template"}
                  isArray={isArray}
                  fieldType={fieldType}
                  enumValues={enumValues}
                  placeholder={`e.g. {{${variables.schemaName || "Schema"}.FirstName}}`}
                  invalid={Boolean(shownError)}
                  onChange={editor.setItem}
                  onFocusItem={setActiveItem}
                  onAdd={() => {
                    editor.addItem();
                    setActiveItem(draft.items.length);
                  }}
                  onRemove={(index) => {
                    editor.removeItem(index);
                    setActiveItem(0);
                  }}
                />

                {draft.kind === "Template" && (
                  <Select value="" onValueChange={insertVariable}>
                    <SelectTrigger className="h-9 w-full" aria-label="Insert variable">
                      <SelectValue placeholder="Insert variable…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templateVariables(variables.schemaName, variables.fields, AUTH_NAMES, isArray).map((variable) => (
                        <SelectItem key={variable} value={variable} className="font-mono text-xs">
                          {variable}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {shownError && (
              <p role="alert" className="text-xs text-rose-500">
                {shownError}
              </p>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-2 border-t border-border/40 bg-card px-6 py-3">
        <StatusSnackbar status={status} />
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted-foreground">Applies to records the service creates from now on</span>
          {saved && (
            <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => void save(null)}>
              Clear
            </Button>
          )}
          <Button type="button" size="sm" disabled={isPending || Boolean(draftError && touched) || !isDirty} onClick={handleSave}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
