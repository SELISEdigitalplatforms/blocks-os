import { PageHeader } from "@/components/page-header/page-header";
import { Card } from "@/components/ui-kits/card/card";
import { Input } from "@/components/ui-kits/input/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Database, Loader2, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { platformDataAccessService } from "./data-access.service";
import { SchemaAccessControlView } from "./gateway/components/schema-access-control/schema-access-control-view";
import { POLICY_OPERATION } from "./gateway/constants/schema-access-control";

const serviceOrder = ["IAM", "OS", "Logic", "Release"] as const;

export function DataAccessPage() {
  const [search, setSearch] = useState("");
  const [selectedSchemaId, setSelectedSchemaId] = useState("");
  const [level, setLevel] = useState<"row" | "column">("row");
  const [selectedField, setSelectedField] = useState("");
  const fieldSelectId = useId();
  const schemasQuery = useQuery({ queryKey: ["platform-data-access-schemas"], queryFn: platformDataAccessService.getSchemas });
  const schemas = useMemo(() => schemasQuery.data?.data ?? [], [schemasQuery.data?.data]);
  const selectedSchema = schemas.find((schema) => schema.id === selectedSchemaId) ?? schemas[0] ?? null;

  const groups = useMemo(() => serviceOrder.map((service) => ({
    service,
    schemas: schemas.filter((schema) => schema.service === service && `${schema.schemaName} ${schema.collectionName}`.toLowerCase().includes(search.trim().toLowerCase())),
  })).filter((group) => group.schemas.length > 0), [schemas, search]);

  const effectiveField = selectedField || selectedSchema?.fields[0]?.name || "";
  const field = selectedSchema?.fields.find((item) => item.name === effectiveField);
  const selectedFieldNames = level === "column" && effectiveField ? [effectiveField] : [];

  return (
    <div>
      <PageHeader title="Data Access" description="Manage Update access for platform collections." />
      <div className="grid min-h-[650px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search collections" />
            </div>
          </div>
          <div className="max-h-[650px] overflow-y-auto p-2">
            {schemasQuery.isLoading && <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
            {groups.map((group) => (
              <section key={group.service} className="mb-3">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{group.service}</p>
                {group.schemas.map((schema) => (
                  <button key={schema.id} type="button" onClick={() => { setSelectedSchemaId(schema.id); setSelectedField(schema.fields[0]?.name ?? ""); setLevel("row"); }} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${selectedSchema?.id === schema.id ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                    <Database className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{schema.schemaName}</span><span className="block truncate text-xs text-muted-foreground">{schema.collectionName}</span></span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </button>
                ))}
              </section>
            ))}
          </div>
        </Card>

        <Card className="min-w-0">
          {selectedSchema ? (
            <>
              <div className="mb-4 border-b pb-4">
                <h2 className="text-lg font-semibold">{selectedSchema.schemaName}</h2>
                <p className="text-sm text-muted-foreground">{selectedSchema.service} · {selectedSchema.collectionName} · Update</p>
              </div>
              <Tabs value={level} onValueChange={(value) => setLevel(value as "row" | "column")}>
                <TabsList><TabsTrigger value="row">Row access</TabsTrigger><TabsTrigger value="column">Column access</TabsTrigger></TabsList>
              </Tabs>
              {level === "column" && (
                <div className="my-4">
                  <label htmlFor={fieldSelectId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Field</label>
                  <select id={fieldSelectId} value={effectiveField} onChange={(event) => setSelectedField(event.target.value)} className="h-10 w-full max-w-sm rounded-md border bg-background px-3 text-sm">
                    {selectedSchema.fields.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </select>
                </div>
              )}
              <div className="mt-4 rounded-md border p-4">
                <SchemaAccessControlView
                  key={`${selectedSchema.id}:${level}:${effectiveField}`}
                  schemaFields={selectedSchema.fields}
                  schemaName={selectedSchema.schemaName}
                  schemaId={selectedSchema.id}
                  level={level}
                  operation={POLICY_OPERATION.UPDATE}
                  fieldNames={selectedFieldNames}
                  defaultAccessLevel={level === "row" ? selectedSchema.editAccessLevel : field?.editAccessLevel}
                />
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No platform collections are available.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
