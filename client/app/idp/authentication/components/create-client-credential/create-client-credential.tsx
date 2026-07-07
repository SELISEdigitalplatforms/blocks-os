import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Search, Plus, Settings, UserCog, ShieldCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useSaveAuthClient } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useForm } from "react-hook-form";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useGetRoles } from "@blocks-idp/iam/hooks/use-roles";
import { useGetPermissions } from "@blocks-idp/iam/hooks/use-permission";
import {
  IClientCredentialsConfig,
  ISaveClientCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  PERMISSION_SEVERITY_OPTIONS,
  PermissionSeverityLevel,
} from "@blocks-idp/iam/models/permission";
import {
  CreateClientModalFormDefaultValues,
  CreateClientModalFormValues,
  createClientSchema,
} from "./utils";
import { isErrorWithErrors } from "@/lib/error";

const MAX_PERMISSIONS = 10;
const PERMISSION_PAGE_SIZE = 20;

const formatPermissionSeverity = (severity: PermissionSeverityLevel | undefined) => {
  return PERMISSION_SEVERITY_OPTIONS.find((opt) => opt.value === severity) ?? null;
};

type CreateClientCredentialProps = {
  editClient?: IClientCredentialsConfig | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export const CreateClientCredential = ({
  editClient,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: CreateClientCredentialProps) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    controlledOnOpenChange?.(v);
  };

  const [roleFilter, setRoleFilter] = useState<string>("");
  const [permFilter, setPermFilter] = useState<string>("");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const isEdit = Boolean(editClient);

  const { mutateAsync: saveServiceClient, isPending } = useSaveAuthClient({
    projectKey: tenantId,
  });

  const { data: rolesData, isLoading: rolesLoading } = useGetRoles({
    page: 0,
    pageSize: 0,
    sort: { property: "Name", isDescending: false },
    filter: { search: roleFilter },
  });

  const { data: permsData, isLoading: permsLoading } = useGetPermissions({
    projectKey: tenantId,
    page: 0,
    pageSize: PERMISSION_PAGE_SIZE,
    isBuiltIn: "",
    roles: [],
    search: permFilter,
  });

  const filteredRoles = useMemo(() => {
    if (!rolesData?.data) return [];
    const lowered = roleFilter.toLowerCase();
    if (!lowered) return rolesData.data;
    return rolesData.data.filter((role) => role.slug.toLowerCase().includes(lowered));
  }, [rolesData, roleFilter]);

  const permissions = useMemo(() => permsData?.data ?? [], [permsData]);

  const form = useForm<CreateClientModalFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: CreateClientModalFormDefaultValues,
  });
  const {
    formState: { isDirty },
    reset,
    watch,
  } = form;

  useEffect(() => {
    if (!open) return;
    if (editClient) {
      reset({
        itemId: editClient.itemId,
        clientNameService: editClient.name,
        accessTokenValidForNumberMinutes: editClient.accessTokenValidForNumberMinutes,
        isActive: editClient.isActive,
        roles: editClient.roles ?? [],
        permissions: editClient.permissions ?? [],
      });
    } else {
      reset(CreateClientModalFormDefaultValues);
    }
    setRoleFilter("");
    setPermFilter("");
  }, [editClient, open, reset]);

  const selectedPermissions = watch("permissions") ?? [];
  const isPermCapReached = selectedPermissions.length >= MAX_PERMISSIONS;

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
      setRoleFilter("");
      setPermFilter("");
    }
    setOpen(isOpen);
  };

  const onSubmit = async (data: CreateClientModalFormValues) => {
    try {
      const payload: ISaveClientCredentialPayload = {
        itemId: data.itemId ?? null,
        name: data.clientNameService,
        isActive: data.isActive,
        accessTokenValidForNumberMinutes: data.accessTokenValidForNumberMinutes,
        roles: data.roles,
        permissions: data.permissions,
        projectKey: tenantId,
      };
      const res = await saveServiceClient(payload);
      if (!res?.isSuccess) return showErrorToast({ errors: res?.errors ?? "Save failed" });
      showSuccessToast({
        description: isEdit
          ? "Client credential updated successfully"
          : "Client credential created successfully",
      });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      return showErrorToast({ errors: "Something went wrong" });
    } finally {
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
              {isEdit ? "Edit Client Credential" : "Add Client Credential"}
            </span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pl-1">
          <DialogTitle>{isEdit ? "Edit Access Token" : "New Access Token"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details for this access token."
              : "Enter details to create a new key."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="max-h-[60vh] space-y-6 overflow-y-auto pl-1 pr-2">
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-medium-emphasis">
                  <Settings className="h-4 w-4" />
                  General
                </div>
                <FormField
                  control={form.control}
                  name="clientNameService"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessTokenValidForNumberMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Token Lifetime (minutes)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={43_200}
                          placeholder="60"
                          value={Number.isFinite(field.value) ? field.value : ""}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? 0 : Number(e.target.value))
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between rounded-sm border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Status</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Inactive credentials cannot be used to obtain new tokens.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            size="md"
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-medium-emphasis">
                  <UserCog className="h-4 w-4" />
                  Roles
                </div>
                <FormField
                  control={form.control}
                  name="roles"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by role name"
                          className="pl-9"
                          value={roleFilter}
                          onChange={(e) => setRoleFilter(e.target.value)}
                        />
                      </div>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4 rounded border p-3">
                          {filteredRoles?.map((type) => {
                            const isChecked = field.value?.includes(type.slug);
                            return (
                              <div key={type.slug} className="flex items-center gap-2">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const updated = checked
                                      ? [...(field.value ?? []), type.slug]
                                      : (field.value ?? []).filter(
                                          (role: string) => role !== type.slug,
                                        );
                                    field.onChange(updated);
                                  }}
                                />
                                <label htmlFor={type.slug} className="cursor-pointer">
                                  {type.slug}
                                </label>
                              </div>
                            );
                          })}
                          {rolesLoading && (
                            <div className="col-span-2 grid gap-2">
                              <Skeleton className="h-12 w-full rounded" />
                            </div>
                          )}
                          {!rolesLoading && filteredRoles?.length === 0 && (
                            <p className="col-span-2 py-2 text-center text-sm text-muted-foreground">
                              No roles found
                            </p>
                          )}
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-medium-emphasis">
                    <ShieldCheck className="h-4 w-4" />
                    Permissions
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {selectedPermissions.length}/{MAX_PERMISSIONS} selected
                    </span>
                    {selectedPermissions.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => form.setValue("permissions", [], { shouldDirty: true })}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by permission name"
                          className="pl-9"
                          value={permFilter}
                          onChange={(e) => setPermFilter(e.target.value)}
                        />
                      </div>
                      <FormControl>
                        <div className="rounded border">
                          {permsLoading && (
                            <div className="grid gap-2 p-3">
                              <Skeleton className="h-10 w-full rounded" />
                              <Skeleton className="h-10 w-full rounded" />
                            </div>
                          )}
                          {!permsLoading && permissions.length === 0 && (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              No permissions found
                            </p>
                          )}
                          {!permsLoading && permissions.length > 0 && (
                            <ul className="max-h-72 divide-y overflow-y-auto">
                              {permissions.map((perm) => {
                                const isChecked = field.value?.includes(perm.resource);
                                const severity = formatPermissionSeverity(
                                  perm.permissionSeverity,
                                );
                                return (
                                  <li
                                    key={perm.itemId}
                                    className="flex items-center gap-3 px-3 py-2"
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={!isChecked && isPermCapReached}
                                      onCheckedChange={(checked) => {
                                        if (checked && (field.value ?? []).length >= MAX_PERMISSIONS)
                                          return;
                                        const updated = checked
                                          ? [...(field.value ?? []), perm.resource]
                                          : (field.value ?? []).filter(
                                              (p: string) => p !== perm.resource,
                                            );
                                        field.onChange(updated);
                                      }}
                                    />
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                      {severity && (
                                        <span
                                          className={`size-2 shrink-0 rounded-full ${severity.barClassName}`}
                                          aria-hidden
                                        />
                                      )}
                                      <span className="truncate text-sm">{perm.name}</span>
                                      <span className="truncate text-xs text-muted-foreground">
                                        {perm.resource}
                                      </span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </FormControl>
                      {isPermCapReached && (
                        <p className="text-xs text-muted-foreground">
                          Maximum of {MAX_PERMISSIONS} permissions reached. Unselect one to add
                          another.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={isPending || !isDirty} type="submit">
                {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
