import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
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
import { Input } from "@/components/ui-kits/input/input";
import { cn } from "@/lib/utils";
import { tStatic, useT } from "@seliseblocks/genesis-os";
import { CheckCircle2, CircleAlert, FlaskConical, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

const I18N_MODULE = "os.idp.settings";

type PasswordPolicyBuilderState = {
  minLength: string;
  maxLength: string;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
};

export const RECOMMENDED_PASSWORD_POLICY: PasswordPolicyBuilderState = {
  minLength: "8",
  maxLength: "30",
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

const PASSWORD_POLICY_MAX_LENGTH = 256;

const characterRequirements = [
  {
    key: "requireUppercase",
    labelKey: "PASSWORD_POLICY_REGEX_BUILDER.UPPERCASE_LETTER",
    example: "A–Z",
  },
  {
    key: "requireLowercase",
    labelKey: "PASSWORD_POLICY_REGEX_BUILDER.LOWERCASE_LETTER",
    example: "a–z",
  },
  { key: "requireNumbers", labelKey: "PASSWORD_POLICY_REGEX_BUILDER.NUMBER", example: "0–9" },
  {
    key: "requireSpecialChars",
    labelKey: "PASSWORD_POLICY_REGEX_BUILDER.SPECIAL_CHARACTER",
    example: "! @ # …",
  },
] as const;

export const getPasswordPolicyBuilderError = (policy: PasswordPolicyBuilderState) => {
  const minLength = Number(policy.minLength);
  const maxLength = Number(policy.maxLength);

  if (
    !Number.isInteger(minLength) ||
    !Number.isInteger(maxLength) ||
    minLength < 1 ||
    maxLength > PASSWORD_POLICY_MAX_LENGTH
  ) {
    return tStatic(I18N_MODULE, "PASSWORD_POLICY_REGEX_BUILDER.LENGTH_RANGE_ERROR", {
      max: PASSWORD_POLICY_MAX_LENGTH,
    });
  }

  if (maxLength < minLength)
    return tStatic(I18N_MODULE, "PASSWORD_POLICY_REGEX_BUILDER.MAX_BELOW_MIN_ERROR");

  return null;
};

export const buildPasswordPolicyRegex = (policy: PasswordPolicyBuilderState) => {
  const assertions = [
    policy.requireLowercase ? "(?=.*[a-z])" : "",
    policy.requireUppercase ? "(?=.*[A-Z])" : "",
    policy.requireNumbers ? "(?=.*\\d)" : "",
    policy.requireSpecialChars ? "(?=.*[\\W_])" : "",
  ].join("");

  return `^${assertions}[A-Za-z\\d\\W_]{${Number(policy.minLength)},${Number(policy.maxLength)}}$`;
};

type PolicyTestResult = "idle" | "invalid" | "match" | "no-match";

export const testPasswordPolicy = (
  policy: PasswordPolicyBuilderState,
  sample: string,
): PolicyTestResult => {
  if (!sample) return "idle";
  if (getPasswordPolicyBuilderError(policy)) return "invalid";

  const minLength = Number(policy.minLength);
  const maxLength = Number(policy.maxLength);
  const matches =
    sample.length >= minLength &&
    sample.length <= maxLength &&
    (!policy.requireUppercase || /[A-Z]/.test(sample)) &&
    (!policy.requireLowercase || /[a-z]/.test(sample)) &&
    (!policy.requireNumbers || /[0-9]/.test(sample)) &&
    (!policy.requireSpecialChars || /[^A-Za-z0-9]/.test(sample));

  return matches ? "match" : "no-match";
};

type PasswordPolicyRegexBuilderProps = {
  onChange: (value: string) => void;
};

const RESULT_COPY_KEYS: Record<PolicyTestResult, string> = {
  idle: "PASSWORD_POLICY_REGEX_BUILDER.RESULT_IDLE",
  invalid: "PASSWORD_POLICY_REGEX_BUILDER.RESULT_INVALID",
  match: "PASSWORD_POLICY_REGEX_BUILDER.RESULT_MATCH",
  "no-match": "PASSWORD_POLICY_REGEX_BUILDER.RESULT_NO_MATCH",
};

export const PasswordPolicyRegexBuilder = ({ onChange }: PasswordPolicyRegexBuilderProps) => {
  const { t } = useT(I18N_MODULE);
  const [policy, setPolicy] = useState<PasswordPolicyBuilderState>(RECOMMENDED_PASSWORD_POLICY);
  const [samplePassword, setSamplePassword] = useState("");
  const builderError = getPasswordPolicyBuilderError(policy);
  const generatedRegex = builderError ? "" : buildPasswordPolicyRegex(policy);
  const testResult = useMemo(
    () => testPasswordPolicy(policy, samplePassword),
    [policy, samplePassword],
  );

  const useRecommendedPolicy = () => {
    setPolicy(RECOMMENDED_PASSWORD_POLICY);
    onChange(buildPasswordPolicyRegex(RECOMMENDED_PASSWORD_POLICY));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="shrink-0 gap-2">
          <WandSparkles className="h-4 w-4" aria-hidden="true" />
          {t("PASSWORD_POLICY_REGEX_BUILDER.BUILD_POLICY")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("PASSWORD_POLICY_REGEX_BUILDER.TITLE")}</DialogTitle>
          <DialogDescription>{t("PASSWORD_POLICY_REGEX_BUILDER.DESCRIPTION")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium" htmlFor="password-policy-min-length">
              {t("PASSWORD_POLICY_REGEX_BUILDER.MINIMUM_LENGTH")}
              <Input
                id="password-policy-min-length"
                type="number"
                inputMode="numeric"
                value={policy.minLength}
                onChange={(event) =>
                  setPolicy((current) => ({ ...current, minLength: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium" htmlFor="password-policy-max-length">
              {t("PASSWORD_POLICY_REGEX_BUILDER.MAXIMUM_LENGTH")}
              <Input
                id="password-policy-max-length"
                type="number"
                inputMode="numeric"
                value={policy.maxLength}
                onChange={(event) =>
                  setPolicy((current) => ({ ...current, maxLength: event.target.value }))
                }
              />
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
              {t("PASSWORD_POLICY_REGEX_BUILDER.REQUIRE_AT_LEAST_ONE")}
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {characterRequirements.map(({ key, labelKey, example }) => (
                <label
                  key={key}
                  htmlFor={`password-policy-${key}`}
                  className="flex cursor-pointer items-center gap-3 rounded-md border bg-background p-3"
                >
                  <Checkbox
                    id={`password-policy-${key}`}
                    checked={policy[key]}
                    onCheckedChange={(checked) =>
                      setPolicy((current) => ({ ...current, [key]: checked === true }))
                    }
                  />
                  <span className="min-w-0 text-sm">
                    <span className="font-medium">{t(labelKey)}</span>
                    <span className="ml-1 text-muted-foreground">({example})</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("PASSWORD_POLICY_REGEX_BUILDER.REGEX_PREVIEW")}
            </p>
            {builderError ? (
              <p className="flex items-center gap-2 text-sm text-warning-700" role="status">
                <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                {builderError}
              </p>
            ) : (
              <code className="block break-all text-sm" data-testid="generated-password-regex">
                {generatedRegex}
              </code>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <label
              className="flex items-center gap-2 text-sm font-medium"
              htmlFor="password-regex-sample"
            >
              <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t("PASSWORD_POLICY_REGEX_BUILDER.TRY_POLICY")}
            </label>
            <Input
              id="password-regex-sample"
              value={samplePassword}
              onChange={(event) => setSamplePassword(event.target.value)}
              placeholder={t("PASSWORD_POLICY_REGEX_BUILDER.SAMPLE_PLACEHOLDER")}
              autoComplete="off"
            />
            <p
              className={cn(
                "flex items-center gap-2 text-xs",
                testResult === "match" && "text-success",
                (testResult === "invalid" || testResult === "no-match") && "text-warning-700",
                testResult === "idle" && "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {testResult === "match" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : testResult === "invalid" || testResult === "no-match" ? (
                <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              {t(RESULT_COPY_KEYS[testResult])}
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" size="sm" variant="outline" onClick={useRecommendedPolicy}>
              {t("PASSWORD_POLICY_REGEX_BUILDER.USE_RECOMMENDED")}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              type="button"
              size="sm"
              onClick={() => onChange(generatedRegex)}
              disabled={!!builderError}
            >
              {t("PASSWORD_POLICY_REGEX_BUILDER.USE_GENERATED")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
