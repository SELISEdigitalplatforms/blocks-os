import { describe, expect, it } from "vitest";
import { checkVariables, parseVariables, variableFieldsOf, type VariableField } from "./variable-syntax";

/**
 * The same table as Genesis `VariableSyntaxTests`: the editor must show exactly the message the server
 * returns for the same text.
 */
const SCHEMA = "Employee";
const FIELDS: Record<string, VariableField> = {
  FirstName: { type: "String", isArray: false, isObject: false },
  LastName: { type: "String", isArray: false, isObject: false },
  Name: { type: "String", isArray: false, isObject: false },
  Age: { type: "Int", isArray: false, isObject: false },
  StartDate: { type: "DateTime", isArray: false, isObject: false },
  Address: { type: "Address", isArray: false, isObject: true },
  "Address.City": { type: "String", isArray: false, isObject: false },
};

const templateError = (text: string, targetIsList = false) => checkVariables(text, "template", SCHEMA, FIELDS, targetIsList)?.message ?? null;
const singleError = (text: string) => checkVariables(text, "single", SCHEMA, FIELDS)?.message ?? null;

describe("variable syntax: templates", () => {
  it.each([
    ["{{Employee.FirstName} {{Employee.LastName}}", 'Unclosed variable at position 1: expected "}}"'],
    ["{Employee.FirstName}", 'Single "{" at position 1: variables are written {{Employee.FirstName}}'],
    ["Hi }}", 'Unexpected "}}" at position 4'],
    ["{{ }}", "Empty variable at position 1"],
    ["{{Employee.First Name}}", 'Invalid name "Employee.First Name" at position 1: use letters, digits, "_" and "." between parts'],
    ["{{FirstName}}", "Missing prefix at position 1: write {{Employee.FirstName}} or {{Auth.…}}"],
    ["{{Department.Name}}", 'Unknown prefix "Department" at position 1: use Employee or Auth'],
    ["{{Employee.FirstNme}}", 'Unknown property "Employee.FirstNme" at position 1 (did you mean Employee.FirstName?)'],
    ["{{Employee.Address}}", '"Employee.Address" holds an object at position 1: use one of its properties, e.g. {{Employee.Address.City}}'],
    ["{{Auth.Mail}}", 'Unknown value "Auth.Mail" at position 1: use Auth.UserId, Auth.Email, Auth.Roles, Auth.Permissions, Auth.OrganizationId'],
    ["{{Auth.Roles}}", "Auth.Roles is a list at position 1: use it in a list property"],
    ["Dear {{Employee.FirstName}", 'Unclosed variable at position 6: expected "}}"'],
  ])("%s", (text, expected) => {
    expect(templateError(text)).toBe(expected);
  });

  it.each(["{{Employee.FirstName}} {{Employee.LastName}}", "{{ Auth.UserId }}", "{{auth.userid}}", "{{Employee.Address.City}}", "Plain text, no variables", ""])(
    "accepts %s",
    (text) => {
      expect(templateError(text)).toBeNull();
    },
  );

  it("allows a list token in a list property", () => {
    expect(templateError("{{Auth.Roles}}", true)).toBeNull();
  });

  it("splits text and variables with positions", () => {
    const { parts, error } = parseVariables("Dear {{Employee.FirstName}}!", "template", SCHEMA);
    expect(error).toBeNull();
    expect(parts).toEqual([
      { text: "Dear ", position: 1 },
      { prefix: "Employee", path: "FirstName", position: 6 },
      { text: "!", position: 28 },
    ]);
  });
});

describe("variable syntax: validation values", () => {
  it.each([
    ["Hi {{Employee.Age}}", "A validation value is either a fixed value or one variable, e.g. {{Employee.Age}}"],
    ["{{Auth.UserId}}", "Auth values aren't available in validation rules at position 1: use an access policy"],
    ["{{StartDate}}", "Missing prefix at position 1: write {{Employee.StartDate}}"],
    ["{{Department.Name}}", 'Unknown prefix "Department" at position 1: use Employee'],
  ])("%s", (text, expected) => {
    expect(singleError(text)).toBe(expected);
  });
});

describe("variableFieldsOf", () => {
  it("lists nested properties by their full path and marks objects", () => {
    const fields = variableFieldsOf([
      { name: "FirstName", type: "String", isArray: false },
      { name: "Address", type: "Address", isArray: false, fields: [{ name: "City", type: "String", isArray: false }] },
    ]);
    expect(fields).toEqual({
      FirstName: { type: "String", isArray: false, isObject: false },
      Address: { type: "Address", isArray: false, isObject: true },
      "Address.City": { type: "String", isArray: false, isObject: false },
    });
  });
});
