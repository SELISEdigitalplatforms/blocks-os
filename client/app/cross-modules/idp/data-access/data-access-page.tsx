import { PageHeader } from "@/components/page-header/page-header";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Database, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { platformDataAccessService } from "./data-access.service";
import type { PlatformSchema, Policy, PolicyPayload, PolicyRule } from "./models";

const UPDATE_OPERATION = 2;
const ROW_POLICY = 0;
const COLUMN_POLICY = 1;
const SERVICE_ORDER = ["IAM", "OS", "Logic", "Release"] as const;
const sourceOptions = [
  { value: 0, label: "Authenticated user" },
  { value: 1, label: "Collection field" },
  { value: 2, label: "Fixed value" },
];
const operatorOptions = [
  "Equal", "Not equal", "Greater than", "Greater than or equal", "Less than", "Less than or equal",
  "Contains", "Does not contain", "In", "Not in", "Starts with", "Ends with", "Is null", "Is not null",
];
const authFields = ["userId", "email", "roles", "permissions", "organizationId"];

const blankRule = (): PolicyRule => ({
  leftSource: 0, leftOperand: "userId", operator: 0, rightSource: 1,
  rightOperand: "CreatedBy", rightOperands: [], staticValue: null,
});

function RuleEditor({ schema, policy, level, onClose }: {
  schema: PlatformSchema;
  policy: Policy | null;
  level: "row" | "column";
  onClose: () => void;
}) {
  const projectKey = useProjectStore().selectedProject?.tenantId ?? "";
  const queryClient = useQueryClient();
  const [name, setName] = useState(policy?.policyName ?? "");
  const [logicalOperator, setLogicalOperator] = useState(policy?.ruleGroup.logicalOperator ?? 0);
  const [rules, setRules] = useState<PolicyRule[]>(policy?.ruleGroup.rules?.length ? policy.ruleGroup.rules : [blankRule()]);
  const [fieldNames, setFieldNames] = useState<string[]>(policy?.fieldNames ?? []);
  const mutation = useMutation({
    mutationFn: async (payload: PolicyPayload) => {
      await platformDataAccessService.setCustomUpdateAccess(
        payload.schemaId,
        payload.policyType,
        payload.fieldNames,
        payload.projectKey,
      );
      return payload.itemId
        ? platformDataAccessService.updatePolicy(payload)
        : platformDataAccessService.createPolicy(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-data-policies", schema.id] });
      onClose();
    },
  });

  const updateRule = (index: number, patch: Partial<PolicyRule>) =>
    setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule));

  const save = () => {
    if (!name.trim() || rules.some((rule) => !rule.leftOperand || (rule.operator < 12 && (rule.rightSource === 2 ? !rule.staticValue : !rule.rightOperand)))) return;
    if (level === "column" && fieldNames.length === 0) return;
    mutation.mutate({
      itemId: policy?.itemId,
      policyName: name.trim(),
      policyDescription: policy?.policyDescription ?? "Configured in OS Data Access",
      policyType: level === "row" ? ROW_POLICY : COLUMN_POLICY,
      operation: UPDATE_OPERATION,
      schemaName: schema.schemaName,
      schemaId: schema.id,
      fieldNames: level === "row" ? [] : fieldNames,
      ruleGroup: { logicalOperator, rules, nestedGroups: policy?.ruleGroup.nestedGroups ?? [] },
      priority: policy?.priority ?? 1,
      isAllowPolicy: policy?.isAllowPolicy ?? true,
      projectKey,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{policy ? "Edit" : "Add"} {level} rule set</DialogTitle>
          <DialogDescription>{schema.schemaName} · Update access</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <label className="block space-y-1.5 text-sm font-medium">Rule set name
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Update own records" />
          </label>
          {level === "column" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Columns</p>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-md border p-3">
                {schema.fields.map((field) => (
                  <label key={field.name} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                    <input type="checkbox" checked={fieldNames.includes(field.name)} onChange={() => setFieldNames((current) => current.includes(field.name) ? current.filter((name) => name !== field.name) : [...current, field.name])} />
                    {field.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Rules</p>
            <div className="flex rounded-md border p-0.5 text-xs">
              <button className={`rounded px-3 py-1.5 ${logicalOperator === 0 ? "bg-primary/15 text-primary" : "text-muted-foreground"}`} onClick={() => setLogicalOperator(0)}>Match all</button>
              <button className={`rounded px-3 py-1.5 ${logicalOperator === 1 ? "bg-primary/15 text-primary" : "text-muted-foreground"}`} onClick={() => setLogicalOperator(1)}>Match any</button>
            </div>
          </div>
          {rules.map((rule, index) => (
            <div key={index} className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={rule.leftSource} onChange={(event) => updateRule(index, { leftSource: Number(event.target.value), leftOperand: Number(event.target.value) === 0 ? "userId" : schema.fields[0]?.name ?? "" })}>{sourceOptions.slice(0, 2).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={rule.leftOperand} onChange={(event) => updateRule(index, { leftOperand: event.target.value })}>{(rule.leftSource === 0 ? authFields : schema.fields.map((field) => field.name)).map((field) => <option key={field} value={field}>{field}</option>)}</select>
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value={rule.operator} onChange={(event) => updateRule(index, { operator: Number(event.target.value) })}>{operatorOptions.map((label, value) => <option key={label} value={value}>{label}</option>)}</select>
              {rule.operator >= 12 ? <div /> : (
                <div className="flex gap-2">
                  <select className="h-10 w-28 rounded-md border bg-background px-2 text-sm" value={rule.rightSource} onChange={(event) => updateRule(index, { rightSource: Number(event.target.value), rightOperand: "", staticValue: null })}>{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  {rule.rightSource === 2 ? <Input value={rule.staticValue ?? ""} onChange={(event) => updateRule(index, { staticValue: event.target.value })} placeholder="Value" /> : <select className="h-10 min-w-28 rounded-md border bg-background px-2 text-sm" value={rule.rightOperand} onChange={(event) => updateRule(index, { rightOperand: event.target.value })}><option value="">Select</option>{(rule.rightSource === 0 ? authFields : schema.fields.map((field) => field.name)).map((field) => <option key={field} value={field}>{field}</option>)}</select>}
                </div>
              )}
              <Button variant="ghost" size="icon" disabled={rules.length === 1} onClick={() => setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRules((current) => [...current, blankRule()])}><Plus className="mr-2 h-4 w-4" />Add rule</Button>
          {mutation.isError && <p className="text-sm text-destructive">Could not save the policy.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save rule set</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DataAccessPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlatformSchema | null>(null);
  const [level, setLevel] = useState<"row" | "column">("row");
  const [editing, setEditing] = useState<Policy | "new" | null>(null);
  const [deleting, setDeleting] = useState<Policy | null>(null);
  const schemasQuery = useQuery({ queryKey: ["platform-data-schemas"], queryFn: platformDataAccessService.getSchemas });
  const policiesQuery = useQuery({
    queryKey: ["platform-data-policies", selected?.id],
    queryFn: () => platformDataAccessService.getPolicies(selected!.schemaName, selected!.id), enabled: !!selected,
  });
  const schemas = schemasQuery.data?.data ?? [];
  useEffect(() => { if (!selected && schemas.length) setSelected(schemas[0]); }, [schemas, selected]);
  const grouped = useMemo(() => SERVICE_ORDER.map((service) => ({ service, schemas: schemas.filter((schema) => schema.service === service && `${schema.schemaName} ${schema.collectionName}`.toLowerCase().includes(search.toLowerCase())) })).filter((group) => group.schemas.length), [schemas, search]);
  const policies = (policiesQuery.data?.data ?? []).filter((policy) => policy.operation === UPDATE_OPERATION && policy.policyType === (level === "row" ? ROW_POLICY : COLUMN_POLICY));
  const remove = useMutation({ mutationFn: platformDataAccessService.deletePolicy, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-data-policies", selected?.id] }) });

  return (
    <div className="space-y-4">
      <PageHeader title="Data Access" description="Manage row and column rules for updating platform collections." />
      <div className="grid min-h-[620px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="p-0">
          <div className="border-b p-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search collections" /></div></div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {schemasQuery.isLoading && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {grouped.map((group) => <section key={group.service} className="mb-3"><p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group.service}</p>{group.schemas.map((schema) => <button key={schema.id} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${selected?.id === schema.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`} onClick={() => setSelected(schema)}><Database className="h-4 w-4" /><span className="min-w-0 flex-1"><span className="block truncate font-medium">{schema.schemaName}</span><span className="block truncate text-xs text-muted-foreground">{schema.collectionName}</span></span><ChevronRight className="h-4 w-4" /></button>)}</section>)}
          </div>
        </Card>
        <Card>
          {!selected ? <div className="grid h-full place-items-center text-sm text-muted-foreground">Select a platform collection.</div> : <>
            <div className="mb-5 flex items-start justify-between border-b pb-4"><div><h2 className="text-lg font-semibold">{selected.schemaName}</h2><p className="text-sm text-muted-foreground">{selected.service} · {selected.collectionName} · Update only</p></div><Button onClick={() => setEditing("new")}><Plus className="mr-2 h-4 w-4" />Add rule set</Button></div>
            <Tabs value={level} onValueChange={(value) => setLevel(value as "row" | "column")}><TabsList><TabsTrigger value="row">Row rules</TabsTrigger><TabsTrigger value="column">Column rules</TabsTrigger></TabsList></Tabs>
            <div className="mt-4 space-y-2">
              {policiesQuery.isLoading && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
              {!policiesQuery.isLoading && policies.length === 0 && <div className="rounded-md border border-dashed p-10 text-center"><p className="font-medium">No {level} rule sets</p><p className="mt-1 text-sm text-muted-foreground">Add a rule set to define who can update this {level === "row" ? "collection" : "collection's fields"}.</p></div>}
              {policies.map((policy) => <div key={policy.itemId} className="flex items-center gap-3 rounded-md border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{policy.policyName}</p><p className="text-xs text-muted-foreground">{policy.ruleGroup.rules.length} rules{level === "column" ? ` · ${policy.fieldNames.length} columns` : ""} · {policy.ruleGroup.logicalOperator === 0 ? "match all" : "match any"}</p></div><Button variant="ghost" size="icon" onClick={() => setEditing(policy)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" disabled={remove.isPending} onClick={() => setDeleting(policy)}><Trash2 className="h-4 w-4" /></Button></div>)}
            </div>
          </>}
        </Card>
      </div>
      {selected && editing && <RuleEditor schema={selected} policy={editing === "new" ? null : editing} level={level} onClose={() => setEditing(null)} />}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <ConfirmationModal
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            if (!deleting?.itemId) return;
            remove.mutate(deleting.itemId, { onSuccess: () => setDeleting(null) });
          }}
          buttonState={{ confirm: { disable: remove.isPending } }}
          data={{
            dialogTitle: policies.length === 1 ? "Delete the only rule set?" : "Delete rule set?",
            dialogSubtitle: policies.length === 1
              ? "This removes the last matching Update rule. Custom access will then grant Update access to nobody."
              : `Are you sure you want to delete ${deleting?.policyName ?? "this rule set"}? This action cannot be undone.`,
            confirmButton: "Delete",
          }}
        />
      </Dialog>
    </div>
  );
}
