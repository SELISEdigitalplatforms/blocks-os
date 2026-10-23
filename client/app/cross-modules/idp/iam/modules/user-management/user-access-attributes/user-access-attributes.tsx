import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useGrantScope } from "@blocks-idp/iam/hooks/use-grant-scope";
import { useGetUserById, useUpdateUser } from "@blocks-idp/iam/hooks/use-user";
import { AccessAttributes } from "@blocks-idp/iam/models/user";
import {
  addAttributeValue,
  ATTRIBUTE_NAME_PATTERN,
  getOrgAccessAttributes,
  removeAttributeValue,
  sameAccessAttributes,
  withOrgAccessAttributes,
} from "@blocks-idp/iam/utils/access-attributes";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { X } from "lucide-react";
import { useState } from "react";

const DEFAULT_ORGANIZATION_ID = "default";

type UserAccessAttributesProps = {
  userId: string;
  projectKey: string;
};

type AttributeAdderProps = {
  /** Names and values the caller may use; `null` means anything (the system user). */
  choices: AccessAttributes | null;
  onAdd: (name: string, value: string) => void;
};

/** Free text for the system user; a pick from the caller's own values for everyone else. */
const AttributeAdder = ({ choices, onAdd }: Readonly<AttributeAdderProps>) => {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const isNameValid = ATTRIBUTE_NAME_PATTERN.test(name);
  const canAdd = isNameValid && value.trim().length > 0;

  const submit = () => {
    if (!canAdd) return;
    onAdd(name, value.trim());
    setValue("");
  };

  if (choices) {
    const values = choices[name] ?? [];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={name || undefined}
          onValueChange={(next) => {
            setName(next);
            setValue("");
          }}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Attribute name">
            <SelectValue placeholder="Attribute" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(choices).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={value || undefined} onValueChange={setValue} disabled={!name}>
          <SelectTrigger className="h-9 w-44" aria-label="Attribute value">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            {values.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={submit}>
          Add
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="h-9 w-44"
        placeholder="Attribute"
        aria-label="Attribute name"
        value={name}
        onChange={(event) => setName(event.target.value.trim())}
      />
      <Input
        className="h-9 w-44"
        placeholder="Value"
        aria-label="Attribute value"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={submit}>
        Add
      </Button>
    </div>
  );
};

/**
 * "Access attributes": the values a data policy can match on (`Auth.Attributes.<name>`), kept per
 * organization on the user. The system user may set anything; anyone else may only hand out values
 * they hold themselves, so their choices come from their own record.
 */
export const UserAccessAttributes = ({ userId, projectKey }: Readonly<UserAccessAttributesProps>) => {
  const authUser = useAuthStore().user;
  const organizationId = authUser?.org_id || DEFAULT_ORGANIZATION_ID;
  const { isRestricted } = useGrantScope();
  const { data: userData } = useGetUserById({ id: userId, projectKey });
  const { data: callerData } = useGetUserById(
    { id: authUser?.sub ?? "", projectKey },
    { enabled: isRestricted && Boolean(authUser?.sub) },
  );
  const { mutateAsync, isPending } = useUpdateUser({ id: userId, projectKey });
  const [draft, setDraft] = useState<AccessAttributes | null>(null);

  const user = userData?.data;
  const saved = getOrgAccessAttributes(user?.attributes, organizationId);
  const current = draft ?? saved;
  const isDirty = draft !== null && !sameAccessAttributes(draft, saved);
  const choices = isRestricted
    ? getOrgAccessAttributes(callerData?.data?.attributes, organizationId)
    : null;
  const names = Object.keys(current).filter((name) => current[name].length > 0);

  const onSave = async () => {
    if (!draft) return;
    try {
      const res = await mutateAsync({
        itemId: userId,
        attributes: withOrgAccessAttributes(user?.attributes, organizationId, draft),
      });
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors });
        return;
      }
      showSuccessToast({ description: "Access attributes updated successfully" });
      setDraft(null);
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : "Something went wrong" });
    }
  };

  return (
    <section
      className="flex shrink-0 flex-col gap-3 rounded-lg border bg-card p-4"
      aria-label="Access attributes"
      data-testid="user-access-attributes"
    >
      <div>
        <h3 className="text-base font-semibold text-high-emphasis">Access attributes</h3>
        <p className="text-sm text-muted-foreground">
          Values that data policies can match on in this organization.
        </p>
      </div>
      {names.length === 0 ? (
        <p className="text-sm text-muted-foreground">No access attributes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {names.map((name) => (
            <li key={name} className="flex flex-wrap items-center gap-2">
              <span className="min-w-24 text-sm font-medium">{name}</span>
              {current[name].map((value) => (
                <Badge key={value} variant="secondary" className="gap-1 font-normal">
                  <span>{value}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${value} from ${name}`}
                    className="inline-flex items-center"
                    onClick={() => setDraft(removeAttributeValue(current, name, value))}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </Badge>
              ))}
            </li>
          ))}
        </ul>
      )}
      <AttributeAdder
        choices={choices}
        onAdd={(name, value) => setDraft(addAttributeValue(current, name, value))}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!isDirty || isPending}
          onClick={() => setDraft(null)}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={onSave}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </section>
  );
};
