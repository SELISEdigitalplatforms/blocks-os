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
import { useProjectStore, useT, tStatic } from "@seliseblocks/genesis-os";
import { useInvitePeople } from "@/hooks/use-people";
import { useGetProjects } from "@/hooks/use-project";
import { MultiSelect } from "@/components/filter-toolbar/multi-select/multi-select";
import { environmentOptions } from "@/constants/environment-options";
import { z } from "zod";

const I18N_MODULE = "os.people";

const createFormSchema = () =>
  z.object({
    invitations: z.array(
      z.object({
        recipients: z
          .string()
          .min(1, tStatic(I18N_MODULE, "INVITE_PEOPLE.RECIPIENT_IS_REQUIRED"))
          .refine(
            (val) => {
              const emails = val
                .split(/[\s,]+/)
                .map((e) => e.trim())
                .filter((e) => e.length > 0);
              if (emails.length === 0) return false;
              return emails.every((email) => emailRegex.test(email));
            },
            tStatic(I18N_MODULE, "INVITE_PEOPLE.INVALID_EMAIL_FORMAT"),
          ),
        projectKeys: z
          .array(z.string())
          .min(1, tStatic(I18N_MODULE, "INVITE_PEOPLE.AT_LEAST_ONE_ENVIRONMENT_IS")),
      }),
    ),
  });

type InvitePeopleFormValues = z.infer<ReturnType<typeof createFormSchema>>;

interface InvitePeopleProps {
  existingEmails?: string[];
  /**
   * Inviting is a grant, not a privilege of ownership — an owner can hand `people::invite` to
   * a contributor, and the endpoint honours it. Gating this on ownership meant the grant could
   * be given and had no visible effect.
   */
  canInvite?: boolean;
}

// The valid addresses in a recipients field, lower-cased.
const validEmailsOf = (recipients: string) =>
  recipients
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && emailRegex.test(e));

export const InvitePeople = ({ existingEmails = [], canInvite = false }: InvitePeopleProps) => {
  const { t } = useT(I18N_MODULE);
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
          label: mapping?.label || p.environment || t("INVITE_PEOPLE.DEFAULT"),
        };
      }),
    );
  }, [projectsData, t]);

  const existingEmailSet = useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  );

  const dynamicFormSchema = useMemo(
    () =>
      createFormSchema().superRefine((data, ctx) => {
        const emailCounts = new Map<string, number>();
        for (const inv of data.invitations) {
          for (const email of validEmailsOf(inv.recipients)) {
            emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
          }
        }
        for (const [index, inv] of data.invitations.entries()) {
          const emails = validEmailsOf(inv.recipients);
          const duplicates = emails.filter((email) => existingEmailSet.has(email));
          if (duplicates.length > 0) {
            ctx.addIssue({
              code: "custom",
              message: t("INVITE_PEOPLE.ALREADY_INVITED", { value1: duplicates.join(", ") }),
              path: ["invitations", index, "recipients"],
            });
          }
          const duplicatesInForm = emails.filter((email) => (emailCounts.get(email) || 0) > 1);
          const uniqueDuplicates = Array.from(new Set(duplicatesInForm));
          const finalDuplicates = uniqueDuplicates.filter((email) => !existingEmailSet.has(email));
          if (finalDuplicates.length > 0) {
            ctx.addIssue({
              code: "custom",
              message: t("INVITE_PEOPLE.DUPLICATE_EMAIL", { value1: finalDuplicates.join(", ") }),
              path: ["invitations", index, "recipients"],
            });
          }
        }
      }),
    [existingEmailSet, t],
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
          errors: t("INVITE_PEOPLE.PLEASE_ADD_AT_LEAST_ONE"),
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

  if (!canInvite) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-10 text-sm text-primary-foreground">
          <Plus className="mr-2 h-4 w-4" />
          <span>{t("INVITE_PEOPLE.INVITE")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md md:min-w-[900px]">
        <DialogHeader>
          <DialogTitle>{t("INVITE_PEOPLE.INVITE_PEOPLE")}</DialogTitle>
          <DialogDescription className="mt-2! text-sm text-medium-emphasis">
            {t("INVITE_PEOPLE.THEY_GET_AN_EMAIL_INVITATION")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)} className="flex min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto p-1 pr-2">
              <div className="space-y-6">
                {/* Two lists side by side with no stated relationship left it unclear whether
                    you were pairing them up or applying one to all. The pairing is per row. */}
                <div className="hidden w-full gap-4 text-sm font-medium text-muted-foreground sm:flex">
                  <div className="w-[45%]">{t("INVITE_PEOPLE.EMAIL_ADDRESS")}</div>
                  <div className="w-[45%]">{t("INVITE_PEOPLE.ENVIRONMENTS_THEY_CAN_WORK_IN")}</div>
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
                                <Input {...emailField} placeholder="name@company.com" />
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
                                label={t("INVITE_PEOPLE.SELECT_ENVIRONMENTS")}
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
                  {t("INVITE_PEOPLE.ADD_ANOTHER_PERSON")}
                </Button>
              </div>
            </div>
            <DialogFooter className="mt-auto pt-4 sm:justify-end">
              <DialogClose asChild>
                <Button variant="secondary" disabled={isPending}>
                  {t("common:CANCEL")}
                </Button>
              </DialogClose>
              <Button disabled={isPending || !form.formState.isValid} type="submit">
                {isPending ? t("INVITE_PEOPLE.SENDING") : t("INVITE_PEOPLE.SEND_INVITATION")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
