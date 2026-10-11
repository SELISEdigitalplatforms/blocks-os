import { useMemo } from "react";
import {
  getPasswordRequirements,
  validatePasswordChecks,
  calculateStrength,
  areAllRequirementsMet,
  getStrengthColor,
} from "../utils/password-strength.util";
import type { PasswordChecks } from "../utils/password-strength.util";

export type { PasswordChecks, PasswordRequirement } from "../utils/password-strength.util";
export { getPasswordRequirements } from "../utils/password-strength.util";

export const usePasswordStrength = (password: string) => {
  const requirements = getPasswordRequirements();
  // Derived from the password on every render, so the result is never a render behind.
  const checks = useMemo<PasswordChecks>(() => validatePasswordChecks(password), [password]);
  const strength = calculateStrength(checks);

  return {
    strength,
    checks,
    allRequirementsMet: areAllRequirementsMet(checks),
    getStrengthColor: () => getStrengthColor(strength),
    requirements,
  };
};
