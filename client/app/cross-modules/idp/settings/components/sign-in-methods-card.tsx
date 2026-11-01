import { useT } from "@seliseblocks/genesis-os";
import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Switch } from "@/components/ui-kits/switch/switch";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import {
  useGetTenantLoginPolicy,
  useSaveTenantLoginPolicy,
} from "@blocks-idp/authentication/hooks/use-login-policy";
import type { ITenantLoginPolicy } from "@blocks-idp/authentication/models/login-policy.model";
import {
  LOGIN_POLICY_LOCKED_MESSAGE,
  locksEveryone,
} from "@blocks-idp/authentication/utils/login-policy.util";
import { ConfigErrorState } from "@blocks-idp/settings/components/config-error-state";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";

type PolicyKey = keyof ITenantLoginPolicy;

type PolicyRow = { key: PolicyKey; labelKey: string; hintKey: string };

const PLACE_ROWS: PolicyRow[] = [
  {
    key: "allowEmbedded",
    labelKey: "SIGN_IN_METHODS_CARD.EMBEDDED_LOGIN",
    hintKey: "SIGN_IN_METHODS_CARD.EMBEDDED_LOGIN_HINT",
  },
  {
    key: "allowOidc",
    labelKey: "SIGN_IN_METHODS_CARD.OIDC_LOGIN",
    hintKey: "SIGN_IN_METHODS_CARD.OIDC_LOGIN_HINT",
  },
];

const METHOD_ROWS: PolicyRow[] = [
  { key: "allowPassword", labelKey: "SIGN_IN_METHODS_CARD.PASSWORD", hintKey: "" },
  {
    key: "allowSocial",
    labelKey: "SIGN_IN_METHODS_CARD.SOCIAL",
    hintKey: "SIGN_IN_METHODS_CARD.SOCIAL_HINT",
  },
];

type ToggleRowProps = {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const ToggleRow = ({ label, hint, checked, onChange }: Readonly<ToggleRowProps>) => (
  <div className={SETTINGS_FORM_LAYOUT.toggleRow}>
    <div className={SETTINGS_FORM_LAYOUT.toggleLabelGroup}>
      <p className={SETTINGS_FORM_LAYOUT.toggleTitle}>{label}</p>
      {hint ? <p className={SETTINGS_FORM_LAYOUT.toggleDescription}>{hint}</p> : null}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </div>
);

type ToggleGroupProps = {
  title: string;
  rows: PolicyRow[];
  policy: ITenantLoginPolicy;
  onChange: (key: PolicyKey, checked: boolean) => void;
};

const ToggleGroup = ({ title, rows, policy, onChange }: Readonly<ToggleGroupProps>) => {
  const { t } = useT("os.idp.settings");
  return (
    <div className="space-y-3">
      <p className={SETTINGS_FORM_LAYOUT.overviewMetaLabel}>{title}</p>
      {rows.map((row) => (
        <ToggleRow
          key={row.key}
          label={t(row.labelKey)}
          hint={row.hintKey ? t(row.hintKey) : ""}
          checked={policy[row.key]}
          onChange={(checked) => onChange(row.key, checked)}
        />
      ))}
    </div>
  );
};

const SignInMethodsForm = ({ saved }: Readonly<{ saved: ITenantLoginPolicy }>) => {
  const { t } = useT("os.idp.settings");
  const [policy, setPolicy] = useState<ITenantLoginPolicy>(saved);
  const { mutateAsync, isPending } = useSaveTenantLoginPolicy();
  const locked = locksEveryone(policy);

  const handleChange = (key: PolicyKey, checked: boolean) =>
    setPolicy((current) => ({ ...current, [key]: checked }));

  const handleSave = async () => {
    if (locked) return;
    try {
      const res = await mutateAsync(policy);
      if (!res.isSuccess) {
        showErrorToast({ errors: res.errors ?? t("SIGN_IN_METHODS_CARD.SOMETHING_WENT_WRONG") });
        return;
      }
      showSuccessToast({ description: t("SIGN_IN_METHODS_CARD.UPDATED") });
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: t("SIGN_IN_METHODS_CARD.SOMETHING_WENT_WRONG") });
    }
  };

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <div className="space-y-1">
        <h3 className={SETTINGS_FORM_LAYOUT.sectionTitle}>{t("SIGN_IN_METHODS_CARD.TITLE")}</h3>
        <p className={SETTINGS_FORM_LAYOUT.fieldDescription}>
          {t("SIGN_IN_METHODS_CARD.DESCRIPTION")}
        </p>
      </div>
      <ToggleGroup
        title={t("SIGN_IN_METHODS_CARD.WHERE")}
        rows={PLACE_ROWS}
        policy={policy}
        onChange={handleChange}
      />
      <ToggleGroup
        title={t("SIGN_IN_METHODS_CARD.HOW")}
        rows={METHOD_ROWS}
        policy={policy}
        onChange={handleChange}
      />
      <p className={SETTINGS_FORM_LAYOUT.fieldDescription}>
        {t("SIGN_IN_METHODS_CARD.TURN_OFF_NOTE")}
      </p>
      {locked && (
        <p className="text-sm text-warning-700" role="alert">
          {LOGIN_POLICY_LOCKED_MESSAGE}
        </p>
      )}
      <div className="flex justify-end">
        <Button size="sm" type="button" disabled={locked || isPending} onClick={handleSave}>
          {t("common:SAVE")}
        </Button>
      </div>
    </Card>
  );
};

/** Project sign-in rules: where users may sign in, and with which method. */
export const SignInMethodsCard = () => {
  const { data, isPending, isError } = useGetTenantLoginPolicy();

  if (isPending) return null;
  if (isError || !data?.loginPolicy) return <ConfigErrorState />;

  return <SignInMethodsForm saved={data.loginPolicy} />;
};
