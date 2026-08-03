import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui-kits/button/button";
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
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray, type FieldArrayWithId } from "react-hook-form";
import {
  buildInvitePeoplePayload,
  describeInviteSuccess,
  describeSkippedInvites,
  emailRegex,
  summarizeInviteOutcomes,
} from "./invite-people-utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useInvitePeople } from "@/hooks/use-people";
import { useGetProjects } from "@/hooks/use-project";
import { MultiSelect } from "@/components/filter-toolbar/multi-select/multi-select";
import { environmentOptions } from "@/constants/environment-options";
import { z } from "zod";

const formSchema = z.object({
  invitations: z.array(
    z.object({
      recipients: z
        .string()
        .min(1, "Recipient is required")
        .refine((val) => {
          const emails = val
            .split(/[\s,]+/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
          if (emails.length === 0) return false;
          return emails.every((email) => emailRegex.test(email));
        }, "Invalid email format"),
      projectKeys: z.array(z.string()).min(1, "At least one environment is required"),
    }),
  ),
});

type InvitePeopleFormValues = z.infer<typeof formSchema>;

interface InvitePeopleProps {
  existingEmails?: string[];
  isViewerOwner?: boolean;
}

export const InvitePeople = ({ existingEmails = [], isViewerOwner = false }: InvitePeopleProps) => {
  const { isPending, mutateAsync } = useInvitePeople();
  const groupId = useProjectStore().selectedTenantGroup;
  const { data: projectsData } = useGetProjects({
    tenantGroupId: groupId ?? "",
    enabled: !!groupId,
  });

  const multiSelectOptions = useMemo(() => {
    if (!projectsData) return [];
    return projectsData.flatMap((group) =>
      group.projects.map((p) => {
        const mapping = environmentOptions.find((o) => o.value === p.environment);
        return {
          value: p.tenantId,
          label: mapping?.label || p.environment || "Default",
        };
      }),
    );
  }, [projectsData]);

  const existingEmailSet = useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  );

  const dynamicFormSchema = useMemo(
    () =>
      formSchema.superRefine((data, ctx) => {
        const emailCounts = new Map<string, number>();
        data.invitations.forEach((inv) => {
          const emails = inv.recipients
            .split(/[\s,]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0 && emailRegex.test(e));
          emails.forEach((email) => {
            emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
          });
        });
        data.invitations.forEach((inv, index) => {
          const emails = inv.recipients
            .split(/[\s,]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0 && emailRegex.test(e));
          const duplicates = emails.filter((email) => existingEmailSet.has(email));
          if (duplicates.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Already invited: ${duplicates.join(", ")}`,
              path: ["invitations", index, "recipients"],
            });
          }
          const duplicatesInForm = emails.filter((email) => (emailCounts.get(email) || 0) > 1);
          const uniqueDuplicates = Array.from(new Set(duplicatesInForm));
          const finalDuplicates = uniqueDuplicates.filter((email) => !existingEmailSet.has(email));
          if (finalDuplicates.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate email: ${finalDuplicates.join(", ")}`,
              path: ["invitations", index, "recipients"],
            });
          }
        });
      }),
    [existingEmailSet],
  );

  const [open, setOpen] = useState(false);

  const form = useForm<InvitePeopleFormValues>({
    defaultValues: {
      invitations: [{ recipients: "", projectKeys: [] }],
    },
    resolver: zodResolver(dynamicFormSchema),
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray<InvitePeopleFormValues, "invitations">({
    control: form.control,
    name: "invitations",
  });

  useEffect(() => {
    if (open) {
      form.reset({
        invitations: [{ recipients: "", projectKeys: [] }],
      });
      form.clearErrors();
    }
  }, [open, form]);

  const onSubmitHandler = async (values: InvitePeopleFormValues) => {
    try {
      const invitationsMap: Record<string, string[]> = {};
      values.invitations.forEach((inv) => {
        const emails = inv.recipients
          .split(/[\s,]+/)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.length > 0 && emailRegex.test(e));
        const uniqueEmails = Array.from(new Set(emails));
        uniqueEmails.forEach((email) => {
          if (!invitationsMap[email]) invitationsMap[email] = [];
          inv.projectKeys.forEach((projectKey) => {
            if (!invitationsMap[email].includes(projectKey)) {
              invitationsMap[email].push(projectKey);
            }
          });
        });
      });

      if (Object.keys(invitationsMap).length === 0) {
        showErrorToast({
          errors: "Please add at least one valid recipient and environment",
        });
        return;
      }

      const response = await mutateAsync(buildInvitePeoplePayload(invitationsMap, groupId ?? ""));

      const { granted, skipped } = summarizeInviteOutcomes(response.results);

      if (granted.length === 0 && skipped.length > 0) {
        showErrorToast({ errors: describeSkippedInvites(skipped) });
        return;
      }

      showSuccessToast({
        description: describeInviteSuccess(granted, skipped),
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      const errorObj = error as {
        errors?: { exceed_limit?: string; resource_limit_exceeded?: string };
      };
      const exceedLimitMessage =
        errorObj?.errors?.exceed_limit || errorObj?.errors?.resource_limit_exceeded;
      showErrorToast({
        errors: exceedLimitMessage || error,
      });
    }
  };

  if (!isViewerOwner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-10 text-sm text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          <span>Invite</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md md:min-w-[900px]">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription className="!mt-2 text-sm text-medium-emphasis">
            Invite new people to the project
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="flex min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto p-1 pr-2">
              <div className="space-y-6">
                <div className="hidden w-full gap-4 text-sm font-medium text-muted-foreground sm:flex">
                  <div className="w-[45%]">Recipient(s)</div>
                  <div className="w-[45%]">Environments</div>
                  <div className="w-[10%]" />
                </div>
                {fields.map(
                  (field: FieldArrayWithId<InvitePeopleFormValues, "invitations", "id">, index) => (
                    <div
                      key={field.id}
                      className="relative flex w-full flex-col items-start gap-4 sm:flex-row"
                    >
                      <div className="flex w-full gap-2 sm:w-[45%]">
                        <FormField
                          name={`invitations.${index}.recipients`}
                          control={form.control}
                          render={({ field: emailField, fieldState }) => (
                            <FormItem className="w-full">
                              <FormControl>
                                <Input {...emailField} placeholder="Enter email" />
                              </FormControl>
                              {fieldState.isTouched && <FormMessage />}
                            </FormItem>
                          )}
                        />
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive sm:hidden"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <FormField
                        control={form.control}
                        name={`invitations.${index}.projectKeys`}
                        render={({ field: projectField }) => (
                          <FormItem className="w-full sm:w-[45%]">
                            <FormControl>
                              <MultiSelect
                                label="Select environments"
                                options={multiSelectOptions}
                                value={projectField.value}
                                onChange={(val) => projectField.onChange(val)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="hidden w-[10%] justify-center sm:flex">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ),
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => append({ recipients: "", projectKeys: [] })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another
                </Button>
              </div>
            </div>
            <DialogFooter className="mt-auto pt-4 sm:justify-end">
              <DialogClose asChild>
                <Button variant="secondary" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={isPending || !form.formState.isValid} type="submit">
                Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
