import { ChipsInput, ChipsInputField, ChipsInputList } from "@/components/chip-input/chips-input";
import { Button } from "@/components/ui-kits/button/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-kits/select/select";
import { PERMISSION_SEVERITY_OPTIONS, RESOURCE_TYPE } from "@blocks-idp/iam/models/permission";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { permissionFormDefaultValue, permissionFormSchema, permissionFormSchemaType, BUILTIN_PERMISSION_READONLY_MESSAGE, isPermissionFormReadOnly } from "./utils";
import { Card, CardContent, CardFooter } from "@/components/ui-kits/card/card";
import { DependentPermissions } from "../dependent-permissions";
import { PermissionGroupCombobox } from "@blocks-idp/iam/components/permission-group-combobox/permission-group-combobox";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { Banner } from "@/components/ui-kits/banner/banner";
type PermissionFormProps = {
  onSave: (data: permissionFormSchemaType) => void;
  isPending: boolean;
  values?: permissionFormSchemaType | null;
  isBuiltIn?: boolean;
  showTags?: boolean;
};
export const PermissionForm = ({
  onSave,
  isPending,
  values = null,
  isBuiltIn = false,
  showTags = true,
}: PermissionFormProps) => {
  const isReadOnly = isPermissionFormReadOnly(isBuiltIn);
  const form = useForm({
    values: values || permissionFormDefaultValue,
    resolver: zodResolver(permissionFormSchema),
  });
  const onSubmit = async (data: permissionFormSchemaType) => {
    onSave(data);
  };
  const resourceType = form.watch("type");
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4">
        {isReadOnly ? (
          <Banner
            variant="warning"
            title="Read-only permission"
            className="mb-0"
            compact={false}
          >
            {BUILTIN_PERMISSION_READONLY_MESSAGE}
          </Banner>
        ) : null}
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter name" disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="type"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Select
                      value={field.value > 0 ? field.value.toString() : undefined}
                      onValueChange={(val) => field.onChange(Number(val))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOURCE_TYPE.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="resource"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resource <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={resourceType === 1 ? "Enter service::controller::name" : "Enter resource"}
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="resourceGroup"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <PermissionGroupCombobox
                      value={field.value}
                      onChange={(value) => {
                        field.onChange(value);
                      }}
                      disabled={isReadOnly}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="permissionSeverity"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Select
                      value={
                        field.value !== undefined && field.value !== null
                          ? field.value.toString()
                          : undefined
                      }
                      onValueChange={(val) => field.onChange(Number(val))}
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                        <SelectValue placeholder="Select Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERMISSION_SEVERITY_OPTIONS.map((item) => (
                          <SelectItem key={item.value} value={item.value.toString()}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showTags ? (
            <FormField
              name="tags"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <div className={isReadOnly ? "pointer-events-none opacity-60" : undefined}>
                      <ChipsInput {...field}>
                        <ChipsInputList />
                        <ChipsInputField />
                      </ChipsInput>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            ) : null}
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem className=" md:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Enter description" disabled={isReadOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {resourceType === 2 && (
              <FormField
                name="dependentPermissions"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Dependent permissions (Max 5)</FormLabel>
                    <FormControl>
                      <DependentPermissions
                        permissionsResource={field.value}
                        onChange={(data) => {
                          field.onChange(data);
                        }}
                        disabled={isReadOnly}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
          <CardFooter className="mt-4 justify-end">
            <Button className="min-w-[80px]" type="submit" disabled={isPending || isReadOnly}>
              Save
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
};
