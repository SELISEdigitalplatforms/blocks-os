import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { PasswordInput } from "@/components/password-input/password-input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { cn } from "@/lib/utils";
import {
  SECRET_DESCRIPTION_MAX_LENGTH,
  SECRET_NAME_MAX_LENGTH,
  SECRET_NAME_PATTERN,
  SECRET_TYPE,
  SECRET_TYPE_LABEL,
  SECRET_TYPE_DESCRIPTION,
  secretTags,
  type SecretAccess,
  type SecretResult,
  type SecretType,
} from "@/cross-modules/secrets/models/secret.model";
import {
  useSecretTags,
  useSetSecret,
  useUpdateSecret,
  useUpdateSecretAccess,
} from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import { UserRolePicker } from "../user-role-picker/user-role-picker";
import { SecretTagInput } from "../secret-tag-input/secret-tag-input";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.secrets";

// Mirrors SecretService.Helpers.cs so the user sees the problem before a round trip. The
// server re-validates regardless; this only saves a failed request.
const createNameField = () =>
  z
    .string()
    .trim()
    .min(1, tStatic(I18N_MODULE, "SECRET_FORM_MODAL.A_NAME_IS_REQUIRED"))
    .max(
      SECRET_NAME_MAX_LENGTH,
      tStatic(I18N_MODULE, "SECRET_FORM_MODAL.NAME_MAX_LENGTH", { max: SECRET_NAME_MAX_LENGTH }),
    )
    .regex(SECRET_NAME_PATTERN, tStatic(I18N_MODULE, "SECRET_FORM_MODAL.START_WITH_A_LETTER_OR"));

const createDescriptionField = () =>
  z
    .string()
    .max(
      SECRET_DESCRIPTION_MAX_LENGTH,
      tStatic(I18N_MODULE, "SECRET_FORM_MODAL.DESCRIPTION_MAX_LENGTH", {
        max: SECRET_DESCRIPTION_MAX_LENGTH,
      }),
    )
    .optional();

// Length is deliberately not validated here. Key Vault's 25 KB cap is enforced server-side and
// comes back as a 400 with reason VALUE_TOO_LARGE, which `applyError` puts on this field — so an
// oversized value still fails clearly, without a byte counter distracting from a limit almost
// nobody reaches.
const createValueField = () =>
  z.string().min(1, tStatic(I18N_MODULE, "SECRET_FORM_MODAL.A_VALUE_IS_REQUIRED"));

const createCreateSchema = () =>
  z.object({
    name: createNameField(),
    description: createDescriptionField(),
    value: createValueField(),
  });

const createEditSchema = () =>
  z.object({
    name: createNameField(),
    description: createDescriptionField(),
    // Never edited here: changing a value is a rotation, which is audited separately.
    value: z.string().optional(),
  });

type FormValues = { name: string; description?: string; value?: string };

/**
 * Types offered when creating a secret.
 *
 * All three, and the choice is permanent: there is no type transition on the backend, because
 * converting one in place would silently move an existing credential between access models.
 * Edit mode reads the type off the secret and renders it read-only, so this list is never
 * consulted there.
 */
const CREATE_TYPE_OPTIONS: SecretType[] = [SECRET_TYPE.Api, SECRET_TYPE.Service, SECRET_TYPE.Both];

const emptyAccess = (): SecretAccess => ({ userIds: [], roles: [] });

// Order is not significant in an access list, so compare as sets — elementwise rather than by
// joining, because user ids and role slugs are opaque and any delimiter could occur inside one.
const sameList = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
};

const sameAccess = (a: SecretAccess, b: SecretAccess): boolean =>
  sameList(a.userIds, b.userIds) && sameList(a.roles, b.roles);

interface SecretFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present switches the modal to edit mode. */
  secret?: SecretResult | null;
}

/**
 * Create and edit a secret.
 *
 * Create has no Status field — every secret is created `active` and lifecycle moves through
 * lock/unlock/delete/restore. Edit has no value field, and because the backend's
 * `UpdateSecretRequest` carries only name and description, an access change is a **second**
 * call to a separately-permissioned endpoint. The submit handler therefore has to cope with
 * the first call succeeding and the second failing.
 *
 * Mount this only while it is open; a fresh mount is what seeds the fields from `secret` and
 * discards a previous attempt.
 */
export function SecretFormModal({ open, onOpenChange, secret }: SecretFormModalProps) {
  const { t } = useT(I18N_MODULE);
  const isEdit = !!secret;
  const [type, setType] = useState<SecretType>(secret?.type ?? SECRET_TYPE.Api);
  const [access, setAccess] = useState<SecretAccess>(() =>
    secret?.access
      ? { userIds: [...secret.access.userIds], roles: [...secret.access.roles] }
      : emptyAccess(),
  );
  const [tags, setTags] = useState<string[]>(() => (secret ? [...secretTags(secret)] : []));
  const [formError, setFormError] = useState<string | null>(null);
  /** Set when metadata saved but the access call did not — changes what a retry has to do. */
  const [metadataSaved, setMetadataSaved] = useState(false);

  const { mutateAsync: createSecret, isPending: isCreating } = useSetSecret();
  const { mutateAsync: updateSecret, isPending: isUpdating } = useUpdateSecret();
  const { mutateAsync: updateAccess, isPending: isUpdatingAccess } = useUpdateSecretAccess();
  const { data: tagCatalogue = [] } = useSecretTags(open);
  const isPending = isCreating || isUpdating || isUpdatingAccess;

  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? createEditSchema() : createCreateSchema()),
    defaultValues: {
      name: secret?.name ?? "",
      description: secret?.description ?? "",
      // Never prefilled: on edit there is no value field at all, and on create the user supplies it.
      value: "",
    },
  });

  const isApi = type === SECRET_TYPE.Api;

  /** Routes a backend reason code onto the field it belongs to, e.g. NAME_INVALID onto `name`. */
  const applyError = (error: unknown, fallback: string) => {
    const info = describeSecretError(error, fallback);
    if (info.field === "name" || info.field === "description") {
      form.setError(info.field, { type: "server", message: info.message });
      setFormError(null);
      return;
    }
    if (info.field === "value" && !isEdit) {
      form.setError("value", { type: "server", message: info.message });
      setFormError(null);
      return;
    }
    setFormError(info.message);
  };

  const submitCreate = async (values: FormValues) => {
    try {
      await createSecret({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        value: values.value ?? "",
        type,
        tags,
        // Only an Application secret carries an access list — for the other categories a
        // stored list would imply a check that is never performed.
        access: isApi ? access : null,
      });
      onOpenChange(false);
    } catch (error) {
      applyError(error, t("SECRET_FORM_MODAL.COULD_NOT_CREATE_THE_SECRET"));
    }
  };

  const submitEdit = async (values: FormValues) => {
    if (!secret) return;

    // Skipped on a retry that only failed at the access step — the metadata is already committed.
    if (!metadataSaved) {
      try {
        await updateSecret({
          secretId: secret.secretId,
          name: values.name.trim(),
          description: values.description?.trim() ?? "",
          // Always sent, because the request replaces the whole set: omitting it on an edit
          // that cleared every chip would leave the old tags in place.
          tags,
        });
      } catch (error) {
        applyError(error, t("SECRET_FORM_MODAL.COULD_NOT_SAVE_THE_SECRET"));
        return;
      }
    }

    const original = secret.access ?? emptyAccess();
    // Only fire the access call when the chips actually changed: `::access` is separately
    // permissioned, so a user who may rename a secret can still be refused here.
    const accessChanged = isApi && !sameAccess(original, access);

    if (!accessChanged) {
      onOpenChange(false);
      return;
    }

    try {
      await updateAccess({ secretId: secret.secretId, access });
      onOpenChange(false);
    } catch (error) {
      // Name and description are already saved. Say so plainly rather than letting a generic
      // failure imply nothing landed, and keep the modal open so a retry redoes only the
      // access call.
      setMetadataSaved(true);
      const info = describeSecretError(
        error,
        tStatic(I18N_MODULE, "SECRET_FORM_MODAL.COULD_NOT_UPDATE_THE_ACCESS"),
      );
      setFormError(t("SECRET_FORM_MODAL.THE_NAME_AND_DESCRIPTION_WERE", { message: info.message }));
    }
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    if (isEdit) await submitEdit(values);
    else await submitCreate(values);
  };

  let submitLabel = t("common:SAVE");
  if (isPending) submitLabel = t("SECRET_FORM_MODAL.SAVING");
  else if (metadataSaved) submitLabel = t("SECRET_FORM_MODAL.RETRY_ACCESS_UPDATE");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">
            {isEdit ? t("SECRET_FORM_MODAL.EDIT_SECRET") : t("SECRET_FORM_MODAL.CREATE_SECRET")}
          </DialogTitle>
          <DialogDescription className="text-left">
            {isEdit
              ? t("SECRET_FORM_MODAL.UPDATE_THE_NAME_DESCRIPTION_TAGS")
              : t("SECRET_FORM_MODAL.STORE_A_NEW_SECRET_THE")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-1">
              {formError && <Banner variant="destructive">{formError}</Banner>}

              <div className="space-y-2">
                <Label>
                  {t("common:TYPE")} {!isEdit && <span className="text-destructive">*</span>}
                </Label>
                {isEdit ? (
                  // The backend has no type transition; changing it would mean a new secret.
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-sm font-medium">{SECRET_TYPE_LABEL[type]}</p>
                    <p className="text-xs text-muted-foreground">{SECRET_TYPE_DESCRIPTION[type]}</p>
                  </div>
                ) : (
                  // A real radio group rather than styled buttons: arrow-key roving focus and
                  // the checked state come from Radix, and each option keeps the sentence that
                  // explains it — the one-word label alone does not say which one you want.
                  <RadioGroup
                    value={type}
                    onValueChange={(value) => setType(value as SecretType)}
                    aria-label={t("common:TYPE")}
                    className="gap-2"
                  >
                    {CREATE_TYPE_OPTIONS.map((option) => (
                      <Label
                        key={option}
                        htmlFor={`secret-type-${option}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border p-3 font-normal transition-colors",
                          type === option
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:border-muted-foreground/40 hover:bg-muted/40",
                        )}
                      >
                        <RadioGroupItem
                          value={option}
                          id={`secret-type-${option}`}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-high-emphasis">
                            {SECRET_TYPE_LABEL[option]}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {SECRET_TYPE_DESCRIPTION[option]}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                )}
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("SECRET_FORM_MODAL.NAME", { span: "*" })}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("SECRET_FORM_MODAL.PAYMENT_GATEWAY_KEY")}
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common:DESCRIPTION")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("SECRET_FORM_MODAL.WHAT_THIS_SECRET_IS_FOR")}
                        className="min-h-[70px]"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEdit && (
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("SECRET_FORM_MODAL.SECRET_VALUE", { span: "*" })}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder={t("SECRET_FORM_MODAL.PASTE_THE_SECRET_VALUE")}
                          autoComplete="off"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("SECRET_FORM_MODAL.STORED_IN_THE_SECRET_STORE")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="space-y-2">
                <Label>{t("SECRET_FORM_MODAL.TAGS")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("SECRET_FORM_MODAL.FOR_GROUPING_AND_FILTERING_ONLY")}
                </p>
                <SecretTagInput
                  value={tags}
                  onChange={setTags}
                  catalogue={tagCatalogue}
                  disabled={isPending}
                />
              </div>

              {isApi && (
                <div className="space-y-2">
                  <Label>{t("SECRET_FORM_MODAL.ACCESS")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("SECRET_FORM_MODAL.WHO_MAY_READ_THIS_SECRET")}
                  </p>
                  <UserRolePicker value={access} onChange={setAccess} disabled={isPending} />
                </div>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {t("common:CANCEL")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
