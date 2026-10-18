/**
 * Validation rules and default values on platform schemas: the same shapes the Data Gateway console uses
 * (blocks-data `models/data-service.ts`), as the OS PlatformDataAccess endpoints return them.
 */

/** How a default is produced: a fixed value, text built from variables, or the insert time. */
export type DefaultValueKind = "Static" | "Template" | "Now";

/** A property's default value (Genesis FieldDefaultValue). */
export interface IFieldDefaultValue {
  kind: DefaultValueKind;
  /** Static: a value, or a list for a list property. Template: a template, or a list of them. */
  value?: string | number | boolean | Array<string | number | boolean> | null;
  /** Now only: the shift from the insert time; each part may be negative. */
  offset?: { days: number; hours: number; minutes: number; seconds: number } | null;
}

export type ValidationRuleValue = string | number | boolean | null;

export interface ISchemaFieldValidation {
  /** ValidationType number; see VALIDATION_TYPE in validation-rules.util. */
  type: number;
  value: ValidationRuleValue;
  secondaryValue: ValidationRuleValue;
  errorMessage: string;
  isActive: boolean;
  /** Rules on platform schemas are always saved as version 1 (items of a list checked one by one, variables read). */
  evaluationVersion?: number;
}

/** A property's rules as the Schemas response carries them (Genesis DataValidation). */
export interface IFieldValidationRule {
  itemId?: string;
  validations: ISchemaFieldValidation[];
}

/** Whether the allow-list opens a property: Allowed, Warned (ask before saving) or Blocked. */
export type RuleAccess = "Allowed" | "Warned" | "Blocked";

/** One property the Genesis allow-list opens, by its dotted path. */
export interface IPlatformFieldRules {
  path: string;
  validation: RuleAccess;
  default: RuleAccess;
  /** The property is never null (a number, true/false, …), so a default can't fill it. */
  defaultHasNoEffect: boolean;
}

/** The schema's rule flags; null when rules are off or the schema takes none. */
export interface IPlatformSchemaRules {
  level: "Normal" | "Warned";
  fields: IPlatformFieldRules[];
}

/** A property, as the variable checks need it. */
export interface IRuleField {
  name: string;
  type: string;
  isArray: boolean;
  fields?: IRuleField[];
}
