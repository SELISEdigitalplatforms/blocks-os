import { FilterControls } from "@/components/filter-toolbar";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { SignupLinkConfigurationFormValues } from "./configuration-form-schema";

type Props = {
  form: UseFormReturn<SignupLinkConfigurationFormValues>;
  formLevelError?: string | null;
};

export const ConfigurationFormFields = ({ form, formLevelError }: Props) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: rolesData } = useGetRoles(
    {
      page: 0,
      pageSize: 100,
      projectKey: tenantId,
      sort: { property: "Name", isDescending: false },
    },
    { enabled: !!tenantId },
  );
  const { data: permissionsData } = useGetPermissions(
    {
      page: 0,
      pageSize: 100,
      projectKey: tenantId,
      search: "",
      isBuiltIn: "",
      roles: [],
    },
    { enabled: !!tenantId },
  );

  const roleOptions = useMemo(
    () =>
      (rolesData?.data ?? []).map((role) => ({
        label: role.name,
        value: role.slug,
      })),
    [rolesData?.data],
  );

  const permissionOptions = useMemo(
    () =>
      (permissionsData?.data ?? []).map((permission) => ({
        label: permission.name,
        value: permission.name,
      })),
    [permissionsData?.data],
  );

  return (
    <div className="flex flex-col gap-4">
      {formLevelError && (
        <p className="text-sm text-destructive" role="alert" data-testid="form-level-error">
          {formLevelError}
        </p>
      )}
      <FormField
        name="name"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Partner onboarding" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="description"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} placeholder="Optional description" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="clientId"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Client</FormLabel>
            <FormControl>
              <Input {...field} placeholder="OIDC client id" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="redirectUri"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Redirect URI</FormLabel>
            <FormControl>
              <Input {...field} placeholder="https://example.com/callback" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="defaultForwardedTo"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Forwarded path</FormLabel>
            <FormControl>
              <Input {...field} placeholder="/welcome (optional)" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="credentialMode"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Credential mode</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select credential mode" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Passwordless">Passwordless</SelectItem>
                <SelectItem value="PasswordRequired">Password required</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="defaultLifetimeMinutes"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lifetime (minutes)</FormLabel>
            <FormControl>
              <Input
                type="number"
                {...field}
                value={field.value === undefined || field.value === null ? "" : field.value}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") {
                    // Empty falls back to 1440 on submit rather than null (Example 5).
                    field.onChange(1440);
                    return;
                  }
                  field.onChange(Number(raw));
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="defaultRoles"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Default roles</FormLabel>
            <FormControl>
              <FilterControls.MultiSelect
                label="Roles"
                options={roleOptions}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="defaultPermissions"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Default permissions</FormLabel>
            <FormControl>
              <FilterControls.MultiSelect
                label="Permissions"
                options={permissionOptions}
                value={field.value}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};
