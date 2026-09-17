import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Input } from "@/components/ui-kits/input/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert, FlaskConical, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

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
  { key: "requireUppercase", label: "Uppercase letter", example: "A–Z" },
  { key: "requireLowercase", label: "Lowercase letter", example: "a–z" },
  { key: "requireNumbers", label: "Number", example: "0–9" },
  { key: "requireSpecialChars", label: "Special character", example: "! @ # …" },
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
    return `Use whole-number lengths from 1 to ${PASSWORD_POLICY_MAX_LENGTH}.`;
  }

  if (maxLength < minLength) return "Maximum length must be greater than or equal to minimum.";

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

const resultCopy: Record<PolicyTestResult, string> = {
  idle: "Enter a sample password to test the builder choices.",
  invalid: "Fix the builder lengths to test this policy. The regex editor remains available.",
  match: "The sample password meets the builder choices.",
  "no-match": "The sample password does not meet every builder choice.",
};

export const PasswordPolicyRegexBuilder = ({ onChange }: PasswordPolicyRegexBuilderProps) => {
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
    <div
      className="space-y-5 rounded-lg border bg-muted/20 p-4"
      aria-label="Password policy builder"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <WandSparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">Build with common password rules</p>
          <Badge variant="secondary" className="font-normal">
            Optional helper
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose the requirements IAM can explain to users. Apply them when ready, or keep writing
          any custom regex above.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium" htmlFor="password-policy-min-length">
          Minimum length
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
          Maximum length
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
        <legend className="mb-2 text-sm font-medium">Require at least one</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {characterRequirements.map(({ key, label, example }) => (
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
                <span className="font-medium">{label}</span>
                <span className="ml-1 text-muted-foreground">({example})</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2 rounded-md border bg-background p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Generated regex preview
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onChange(generatedRegex)}
          disabled={!!builderError}
        >
          Use generated regex
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={useRecommendedPolicy}>
          Use recommended policy
        </Button>
      </div>

      <div className="space-y-2 border-t pt-4">
        <label
          className="flex items-center gap-2 text-sm font-medium"
          htmlFor="password-regex-sample"
        >
          <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Try the builder policy
        </label>
        <Input
          id="password-regex-sample"
          value={samplePassword}
          onChange={(event) => setSamplePassword(event.target.value)}
          placeholder="Sample only — this is not saved"
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
          {resultCopy[testResult]}
        </p>
      </div>
    </div>
  );
};
