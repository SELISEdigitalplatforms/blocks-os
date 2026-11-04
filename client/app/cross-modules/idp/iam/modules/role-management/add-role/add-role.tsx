import { useT } from "@seliseblocks/genesis-os";
import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { addRoleFormDefaultValue, createAddRoleFormSchema, AddRoleFormValues } from "./utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useAddRole } from "@blocks-idp/iam/hooks/use-roles";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { toSnakeCase } from "@/lib/utils";
import { ManagedBySelect } from "../managed-by-select";
import { isAccessGrantRefused } from "@/lib/error";
// Named export here, unlike the blocks-iam copy, which default-exports it.
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { CreateRolePayload, CreateRoleResponse } from "@blocks-idp/iam/models/role";

/** Server error codes that belong on a specific form field rather than in a toast. */
const FIELD_ERROR_CODES: Record<string, "name" | "slug"> = {
  Name: "name",
  Slug: "slug",
};
type HttpError = { status: number; errors: Record<string, string | string[]> };

const isHttpError = (error: unknown): error is HttpError =>
  !!error && typeof error === "object" && "status" in error && "errors" in error;

type DuplicateNamePrompt = {
  payload: CreateRolePayload;
  otherOrganizationCount: number;
  slugConflictCount: number;
};

const duplicatePromptFor = (
  payload: CreateRolePayload,
  response: CreateRoleResponse | undefined,
): DuplicateNamePrompt | null =>
  response?.requiresDuplicateNameConfirmation
    ? {
        payload,
        otherOrganizationCount: response.duplicateNameOrganizationCount ?? 0,
        slugConflictCount: response.slugConflictOrganizationCount ?? 0,
      }
    : null;

/** Splits server errors into the ones that belong on a form field and the rest. */
const splitFieldErrors = (errors: Record<string, string | string[]>) => {
  const routed: ["name" | "slug", string][] = [];
  const unmapped: Record<string, string | string[]> = {};
  for (const [code, message] of Object.entries(errors)) {
    const field = FIELD_ERROR_CODES[code];
    if (field) routed.push([field, Array.isArray(message) ? message.join(" ") : message]);
    else unmapped[code] = message;
  }
  return { routed, unmapped };
};

export const AddRole = () => {
  const { t } = useT("os.idp.roles");
  const [isAddRoleOpenModal, setIsAddRoleOpenModal] = useState(false);
  // Slug auto-syncs from the name until the user edits it manually.
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  // Held while the administrator decides whether to create a role whose name other organizations
  // already use. The submitted payload is kept rather than re-read from the form, so the
  // confirmation applies to exactly what was sent.
  const [duplicateNamePrompt, setDuplicateNamePrompt] = useState<DuplicateNamePrompt | null>(null);
  const { mutateAsync, isPending } = useAddRole();
  const form = useForm({
    defaultValues: addRoleFormDefaultValue,
    resolver: zodResolver(createAddRoleFormSchema()),
  });
  const {
    formState: { isDirty },
  } = form;
  const handleHttpError = (httpError: HttpError, payload: CreateRolePayload) => {
    // The same question, arriving as a rejection because the endpoint answers it with a
    // non-success status.
    const prompt = duplicatePromptFor(payload, httpError as unknown as CreateRoleResponse);
    if (prompt) {
      setDuplicateNamePrompt(prompt);
      return;
    }

    if (httpError.status === 403 && !isAccessGrantRefused(httpError)) {
      showErrorToast({
        title: t("ADD_ROLE.FORBIDDEN_TITLE"),
        errors: t("ADD_ROLE.FORBIDDEN_MESSAGE"),
      });
      return;
    }

    // Field-coded reasons go back onto their field; anything else is a toast.
    const { routed, unmapped } = splitFieldErrors(httpError.errors ?? {});
    routed.forEach(([field, text]) => form.setError(field, { type: "server", message: text }));
    const hasUnmapped = Object.keys(unmapped).length > 0;
    if (hasUnmapped || routed.length === 0) {
      showErrorToast({ errors: hasUnmapped ? unmapped : httpError.errors });
    }
  };

  const submitRole = async (payload: CreateRolePayload) => {
    try {
      const response = (await mutateAsync(payload)) as CreateRoleResponse | undefined;

      // The one refusal that is a question rather than an error: the name is free in this
      // organization, but other organizations already use it, and creating this one gives them a
      // second role sharing it.
      const prompt = duplicatePromptFor(payload, response);
      if (prompt) {
        setDuplicateNamePrompt(prompt);
        return;
      }

      showSuccessToast({ description: t("ADD_ROLE.ADDED_SUCCESS") });
      setDuplicateNamePrompt(null);
      setIsAddRoleOpenModal(false);
      form.reset();
    } catch (error: unknown) {
      setDuplicateNamePrompt(null);

      if (isHttpError(error)) {
        handleHttpError(error, payload);
      } else if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  const onSubmit: SubmitHandler<AddRoleFormValues> = async (data) =>
    submitRole({
      name: data.name,
      description: data.description || "",
      slug: data.slug,
      // Omitted when empty, so a role without a "Managed by" sends what it always sent.
      ...(data.parentRoleSlug ? { parentRoleSlug: data.parentRoleSlug } : {}),
    });
  return (
    <Dialog
      open={isAddRoleOpenModal}
      onOpenChange={(value) => {
        form.reset(addRoleFormDefaultValue);
        setIsSlugManuallyEdited(false);
        setIsAddRoleOpenModal(value);
      }}
    >
      <DialogTrigger asChild>
        <PrimaryButton label={t("ADD_ROLE.ADD_BUTTON")} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="mb-4">
          <DialogTitle>{t("ADD_ROLE.TITLE")}</DialogTitle>
          <DialogDescription>{t("ADD_ROLE.DESCRIPTION")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common:NAME")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("ADD_ROLE.NAME_PLACEHOLDER")}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!isSlugManuallyEdited) {
                          form.setValue("slug", toSnakeCase(e.target.value), {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="slug"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ADD_ROLE.SLUG_LABEL")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("ADD_ROLE.SLUG_PLACEHOLDER")}
                      onChange={(e) => {
                        setIsSlugManuallyEdited(true);
                        field.onChange(e);
                      }}
                    />
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
                  <FormLabel>{t("common:DESCRIPTION")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={t("ADD_ROLE.DESCRIPTION_PLACEHOLDER")} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="parentRoleSlug"
              control={form.control}
              render={({ field }) => (
                <ManagedBySelect
                  value={field.value}
                  onChange={(slug) => field.onChange(slug)}
                  disabled={isPending}
                />
              )}
            />
            <DialogFooter className="mt-6">
              <DialogTrigger asChild>
                <Button className="min-w-[80px]" variant="outline" disabled={isPending}>
                  {t("common:CANCEL")}
                </Button>
              </DialogTrigger>
              <Button className="min-w-[80px]" type="submit" disabled={isPending || !isDirty}>
                {isPending ? t("ADD_ROLE.ADDING") : t("common:ADD")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Outside the add-role DialogContent so cancelling returns the administrator to the form
          with their values intact rather than discarding the attempt. */}
      <Dialog
        open={duplicateNamePrompt !== null}
        onOpenChange={(open) => {
          if (!open) setDuplicateNamePrompt(null);
        }}
      >
        {duplicateNamePrompt && (
          <ConfirmationModal
            data={{
              dialogTitle: t("ADD_ROLE.DUPLICATE_TITLE"),
              dialogSubtitle: [
                t("ADD_ROLE.DUPLICATE_OTHER_ORGS", {
                  count: duplicateNamePrompt.otherOrganizationCount,
                }),
                t("ADD_ROLE.DUPLICATE_SHARE"),
                duplicateNamePrompt.slugConflictCount > 0
                  ? t("ADD_ROLE.DUPLICATE_KEEP", { count: duplicateNamePrompt.slugConflictCount })
                  : "",
              ]
                .filter(Boolean)
                .join(" "),
              confirmButton: isPending ? t("ADD_ROLE.CREATING") : t("ADD_ROLE.CREATE_ANYWAY"),
              cancelButton: t("common:CANCEL"),
            }}
            onCancel={() => setDuplicateNamePrompt(null)}
            onConfirm={() =>
              submitRole({ ...duplicateNamePrompt.payload, confirmDuplicateName: true })
            }
            buttonState={{ confirm: { disable: isPending } }}
          />
        )}
      </Dialog>
    </Dialog>
  );
};
