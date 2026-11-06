using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Evaluation;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Data;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.ResponseModel;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;

namespace Configuration.DomainService.DataGateway.Services
{
    public sealed class PlatformDataAccessService(IDbContextProvider databaseProvider, IConfiguration? configuration = null) : IPlatformDataAccessService
    {
        /// <summary>
        /// Validation rules and default values on system schemas. Off until IAM, OS, Logic and Release all run a
        /// Genesis that understands them: while off the rule endpoints answer 404 and Schemas carries no rule flags.
        /// </summary>
        public const string RulesEnabledSetting = "PlatformDataAccess:RulesEnabled";

        private bool RulesEnabled => configuration?.GetValue<bool>(RulesEnabledSetting) ?? false;

        /// <summary>
        /// Whether warned schemas (sign-in, the console: User, Role, mail configuration, …) and warned properties
        /// (row access lists, template bodies, …) are offered too. Off by default: only Normal schemas and their
        /// Allowed properties, the ones that cannot stop a service from saving or users from signing in.
        /// </summary>
        public const string RulesIncludeWarnedSetting = "PlatformDataAccess:RulesIncludeWarned";

        private bool RulesIncludeWarned => configuration?.GetValue<bool>(RulesIncludeWarnedSetting) ?? false;

        // View, Create, Edit and Delete, as the services check them. ALL is left out: services never ask for it.
        private static readonly PolicyOperation[] Operations = [PolicyOperation.READ, PolicyOperation.WRITE, PolicyOperation.EDIT, PolicyOperation.DELETE];

        // Field rules the services apply: Genesis derives column rules for READ and EDIT only.
        private static readonly PolicyOperation[] FieldOperations = [PolicyOperation.READ, PolicyOperation.EDIT];

        /// <summary>The base entity's own properties, which every system schema has: the only ones bulk changes may touch.</summary>
        private static readonly HashSet<string> DefaultPropertyNames =
            typeof(BaseEntity).GetProperties().Select(p => p.Name).ToHashSet(StringComparer.Ordinal);

        private const int BulkLimit = 100;

        public async Task<PlatformDataAccessResult> GetSchemasAsync(CancellationToken cancellationToken)
        {
            var schemas = await SchemaCollection.Find(x => x.IsSystemEntity && !x.IsDeleted).ToListAsync(cancellationToken);
            var rulesEnabled = RulesEnabled;
            // Only these schemas' rules are read: a tenant's rule may have a type this Genesis can't read.
            var systemIds = schemas.Select(x => x.ItemId).ToList();
            var validations = rulesEnabled
                ? await ValidationCollection.Find(x => !x.IsDeleted && systemIds.Contains(x.SchemaId)).ToListAsync(cancellationToken)
                : [];
            var result = schemas.Where(x => PlatformSchemaCatalog.IsOffered(x.SchemaName)).Select(x => new
            {
                id = x.ItemId,
                x.SchemaName,
                x.CollectionName,
                service = PlatformSchemaCatalog.Owners[x.SchemaName],
                // All four levels, one per access tab in the console.
                readAccessLevel = (int)x.ReadAccessLevel,
                writeAccessLevel = (int)x.WriteAccessLevel,
                editAccessLevel = (int)x.EditAccessLevel,
                deleteAccessLevel = (int)x.DeleteAccessLevel,
                fields = FieldDefinitionMapper.GetFieldDefinitionResponses(PlatformSchemaCatalog.VisibleFields(x), [], validations.Where(v => v.SchemaId == x.ItemId).ToList()),
                // Which properties take validation rules and defaults (the Genesis allow-list); null when none do or rules are off.
                rules = rulesEnabled ? RuleFlags(x.SchemaName) : null
            }).OrderBy(x => x.service).ThenBy(x => x.SchemaName).ToList();
            return PlatformDataAccessResult.Ok(result);
        }

        public async Task<PlatformDataAccessResult> GetPoliciesAsync(string schemaId, CancellationToken cancellationToken)
        {
            if (!await IsPlatformSchemaAsync(schemaId, cancellationToken)) return PlatformDataAccessResult.NotFound();
            var policies = await PolicyCollection.Find(x => x.SchemaId == schemaId && !x.IsDeleted && Operations.Contains(x.Operation))
                .ToListAsync(cancellationToken);
            var result = policies.Select(policy => new
            {
                policy.ItemId,
                policy.PolicyName,
                policy.PolicyDescription,
                policy.PolicyType,
                policy.Operation,
                entityName = policy.SchemaName,
                policy.SchemaId,
                policy.FieldNames,
                policy.RuleGroup,
                policy.Priority,
                policy.IsAllowPolicy,
                projectKey = string.Empty
            });
            return PlatformDataAccessResult.Ok(result);
        }

        public async Task<PlatformDataAccessResult> SavePolicyAsync(SavePlatformPolicyRequest request, string? itemId, CancellationToken cancellationToken)
        {
            var schema = await SchemaCollection.Find(x => x.ItemId == request.SchemaId && x.IsSystemEntity && !x.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            if (schema is null || !PlatformSchemaCatalog.IsOffered(schema.SchemaName)) return PlatformDataAccessResult.NotFound();
            var policyType = request.PolicyType ?? default;
            if (request.Operation is not { } operation || !IsValidPolicyRequest(request, operation, policyType, schema)) return PlatformDataAccessResult.Invalid();

            var policy = await LoadOrCreatePolicyAsync(itemId, schema, cancellationToken);
            if (policy is null) return PlatformDataAccessResult.NotFound();

            policy.PolicyName = request.PolicyName.Trim();
            policy.PolicyDescription = request.PolicyDescription ?? string.Empty;
            policy.PolicyType = policyType;
            policy.Operation = operation;
            policy.SchemaName = schema.SchemaName;
            policy.SchemaId = schema.ItemId;
            policy.FieldNames = request.FieldNames;
            policy.RuleGroup = request.RuleGroup;
            policy.Priority = request.Priority ?? 1;
            policy.IsAllowPolicy = request.IsAllowPolicy ?? true;
            policy.LastUpdatedDate = DateTime.UtcNow;

            if (policyType == PolicyType.RLS) SetAccessLevel(schema, operation, SchemaAccessLevel.Custom);
            else foreach (var field in schema.Fields.Where(field => request.FieldNames.Contains(field.Name))) SetAccessLevel(field, operation, SchemaAccessLevel.Custom);

            await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
            await PolicyCollection.ReplaceOneAsync(x => x.ItemId == policy.ItemId, policy, new ReplaceOptions { IsUpsert = true }, cancellationToken);
            return PlatformDataAccessResult.Ok(new { acknowledged = true, itemId = policy.ItemId });
        }

        public async Task<PlatformDataAccessResult> ConfigureAsync(ConfigurePlatformAccessRequest request, CancellationToken cancellationToken)
        {
            var schema = await SchemaCollection.Find(x => x.ItemId == request.SchemaId && x.IsSystemEntity && !x.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            if (schema is null || !PlatformSchemaCatalog.IsOffered(schema.SchemaName) || request.Operation is not { } operation || !Operations.Contains(operation)) return PlatformDataAccessResult.Invalid();
            var accessLevel = request.AccessLevel ?? default;
            if ((request.PolicyType ?? default) == PolicyType.RLS) SetAccessLevel(schema, operation, accessLevel);
            else
            {
                if (!FieldOperations.Contains(operation) || request.FieldNames.Length == 0
                    || request.FieldNames.Any(name => VisibleField(schema, name) is null)) return PlatformDataAccessResult.Invalid();
                foreach (var field in schema.Fields.Where(field => request.FieldNames.Contains(field.Name))) SetAccessLevel(field, operation, accessLevel);
            }
            await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
            return PlatformDataAccessResult.Ok(new { acknowledged = true, itemId = schema.ItemId });
        }

        public async Task<PlatformDataAccessResult> DeletePolicyAsync(string itemId, CancellationToken cancellationToken)
        {
            // Only a system schema's policy is read: a tenant's may have an operator this Genesis can't read.
            var systemIds = await SchemaCollection.Find(x => x.IsSystemEntity && !x.IsDeleted).Project(x => x.ItemId).ToListAsync(cancellationToken);
            var policy = await PolicyCollection.Find(x => x.ItemId == itemId && systemIds.Contains(x.SchemaId) && Operations.Contains(x.Operation))
                .FirstOrDefaultAsync(cancellationToken);
            if (policy is null || !await IsPlatformSchemaAsync(policy.SchemaId, cancellationToken)) return PlatformDataAccessResult.NotFound();
            await PolicyCollection.DeleteOneAsync(x => x.ItemId == itemId, cancellationToken);
            return PlatformDataAccessResult.Ok(new { acknowledged = true, itemId });
        }

        public async Task<PlatformDataAccessResult> GetValidationAsync(string schemaId, string fieldName, CancellationToken cancellationToken)
        {
            if (!RulesEnabled || await LoadRulesSchemaAsync(schemaId, cancellationToken) is null) return PlatformDataAccessResult.NotFound();
            var validation = await ValidationCollection.Find(x => x.SchemaId == schemaId && x.FieldName == fieldName && !x.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            return PlatformDataAccessResult.Ok(validation is null ? null : new { validation.ItemId, validation.Validations });
        }

        public async Task<PlatformDataAccessResult> SaveValidationAsync(SavePlatformValidationRequest request, CancellationToken cancellationToken)
        {
            if (!RulesEnabled || await LoadRulesSchemaAsync(request.SchemaId, cancellationToken) is not { } loaded) return PlatformDataAccessResult.NotFound();
            var (schema, rules) = loaded;
            var field = VisibleField(schema, request.FieldName);
            if (field is null || rules.ValidationFor(field.Name) == RuleAccess.Blocked)
                return PlatformDataAccessResult.Refused(request.FieldName, $"Validation rules can't be set on {schema.SchemaName}.{request.FieldName}");

            NormaliseRules(request.Validations);
            if (await CheckRulesAsync(schema, field, request.Validations, cancellationToken) is { } problem)
                return PlatformDataAccessResult.Refused(request.FieldName, problem);

            var existing = await ValidationCollection.Find(x => x.SchemaId == schema.ItemId && x.FieldName == field.Name && !x.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            var itemId = await WriteValidationAsync(schema.ItemId, field.Name, existing, request.Validations, cancellationToken);
            return PlatformDataAccessResult.Ok(new { acknowledged = true, itemId });
        }

        public async Task<PlatformDataAccessResult> BulkValidationAsync(BulkPlatformValidationRequest request, CancellationToken cancellationToken)
        {
            if (!RulesEnabled) return PlatformDataAccessResult.NotFound();
            if (BulkTargetsProblem(request.SchemaIds, request.FieldNames) is { } shape) return PlatformDataAccessResult.Refused("fieldNames", shape);
            NormaliseRules(request.Validations);

            var errors = new Dictionary<string, string>();
            var writes = new List<ValidationWrite>();
            foreach (var schemaId in request.SchemaIds.Distinct())
            {
                if (await LoadRulesSchemaAsync(schemaId, cancellationToken) is { } loaded)
                    await PlanValidationWritesAsync(loaded.Schema, loaded.Rules, request, errors, writes, cancellationToken);
                else
                    errors[schemaId] = "This schema doesn't take validation rules";
            }
            if (errors.Count > 0) return PlatformDataAccessResult.Refused(errors);

            foreach (var (schemaId, fieldName, existing, next) in writes)
                await WriteValidationAsync(schemaId, fieldName, existing, next, cancellationToken);
            return PlatformDataAccessResult.Ok(new { acknowledged = true, count = writes.Count });
        }

        public async Task<PlatformDataAccessResult> SetFieldDefaultAsync(SetPlatformFieldDefaultRequest request, CancellationToken cancellationToken)
        {
            if (!RulesEnabled || await LoadRulesSchemaAsync(request.SchemaId, cancellationToken) is not { } loaded) return PlatformDataAccessResult.NotFound();
            var (schema, rules) = loaded;
            var field = VisibleField(schema, request.FieldName);
            if (field is null || rules.DefaultFor(field.Name) == RuleAccess.Blocked)
                return PlatformDataAccessResult.Refused(request.FieldName, $"A default value can't be set on {schema.SchemaName}.{request.FieldName}");

            var defaultValue = StorableDefault(request.DefaultValue);
            if (CheckDefault(schema, field, defaultValue) is { } problem) return PlatformDataAccessResult.Refused(request.FieldName, problem);

            field.DefaultValue = defaultValue;
            await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
            return PlatformDataAccessResult.Ok(new { acknowledged = true, itemId = schema.ItemId });
        }

        public async Task<PlatformDataAccessResult> BulkFieldDefaultAsync(BulkPlatformFieldDefaultRequest request, CancellationToken cancellationToken)
        {
            if (!RulesEnabled) return PlatformDataAccessResult.NotFound();
            if (BulkTargetsProblem(request.SchemaIds, request.FieldNames) is { } shape) return PlatformDataAccessResult.Refused("fieldNames", shape);
            var defaultValue = StorableDefault(request.DefaultValue);

            var errors = new Dictionary<string, string>();
            var schemas = new List<(SchemaDefinition Schema, List<FieldDefinition> Fields)>();
            foreach (var schemaId in request.SchemaIds.Distinct())
            {
                if (await LoadRulesSchemaAsync(schemaId, cancellationToken) is not { } loaded)
                {
                    errors[schemaId] = "This schema doesn't take default values";
                    continue;
                }
                var (schema, rules) = loaded;
                var fields = new List<FieldDefinition>();
                foreach (var fieldName in request.FieldNames.Distinct())
                {
                    var key = $"{schema.SchemaName}.{fieldName}";
                    var field = VisibleField(schema, fieldName);
                    if (field is null || rules.DefaultFor(field.Name) == RuleAccess.Blocked) errors[key] = $"A default value can't be set on {key}";
                    else if (CheckDefault(schema, field, defaultValue) is { } problem) errors[key] = problem;
                    else fields.Add(field);
                }
                schemas.Add((schema, fields));
            }
            if (errors.Count > 0) return PlatformDataAccessResult.Refused(errors);

            foreach (var (schema, fields) in schemas)
            {
                foreach (var field in fields) field.DefaultValue = defaultValue;
                await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
            }
            return PlatformDataAccessResult.Ok(new { acknowledged = true, count = schemas.Sum(x => x.Fields.Count) });
        }

        /// <summary>The allow-list as this environment offers it: warned schemas and properties left out unless switched on.</summary>
        private SystemSchemaRuleSet? OfferedRules(string schemaName)
        {
            var rules = SystemSchemaRules.For(schemaName);
            if (rules is null || RulesIncludeWarned) return rules;
            if (rules.Level == RuleLevel.Warned) return null;

            static RuleAccess AllowedOnly(RuleAccess access) => access == RuleAccess.Allowed ? RuleAccess.Allowed : RuleAccess.Blocked;
            var fields = rules.Fields.Values
                .Select(f => f with { Validation = AllowedOnly(f.Validation), Default = AllowedOnly(f.Default) })
                .Where(f => f.Validation != RuleAccess.Blocked || f.Default != RuleAccess.Blocked)
                .ToDictionary(f => f.Path, StringComparer.Ordinal);
            return rules with { Fields = fields };
        }

        private sealed record ValidationWrite(string SchemaId, string FieldName, DataValidation? Existing, List<ValidationRule> Rules);

        /// <summary>One schema's share of a bulk validation: what each picked property would get, or why it can't.</summary>
        private async Task PlanValidationWritesAsync(SchemaDefinition schema, SystemSchemaRuleSet rules, BulkPlatformValidationRequest request,
            Dictionary<string, string> errors, List<ValidationWrite> writes, CancellationToken cancellationToken)
        {
            var stored = await ValidationCollection.Find(x => x.SchemaId == schema.ItemId && !x.IsDeleted).ToListAsync(cancellationToken);
            foreach (var fieldName in request.FieldNames.Distinct())
            {
                var key = $"{schema.SchemaName}.{fieldName}";
                var field = VisibleField(schema, fieldName);
                if (field is null || rules.ValidationFor(field.Name) == RuleAccess.Blocked)
                {
                    errors[key] = $"Validation rules can't be set on {key}";
                    continue;
                }
                var existing = stored.FirstOrDefault(x => x.FieldName == field.Name);
                List<ValidationRule> next = request.Replace == true || existing is null ? [.. request.Validations] : [.. existing.Validations, .. request.Validations];
                if (await CheckRulesAsync(schema, field, next, cancellationToken) is { } problem) errors[key] = problem;
                else writes.Add(new ValidationWrite(schema.ItemId, field.Name, existing, next));
            }
        }

        /// <summary>Why a bulk request's schemas and properties can't be used, or null when they can.</summary>
        private static string? BulkTargetsProblem(List<string> schemaIds, List<string> fieldNames)
        {
            if (schemaIds.Count == 0 || fieldNames.Count == 0) return "Pick at least one schema and one property";
            if (schemaIds.Count > BulkLimit || fieldNames.Count > BulkLimit) return $"At most {BulkLimit} schemas and {BulkLimit} properties at once";
            var other = fieldNames.FirstOrDefault(name => !DefaultPropertyNames.Contains(name.Split('.')[0]));
            return other is null ? null : $"{other} isn't a default property; bulk changes only take the base entity's properties";
        }

        /// <summary>Rules as stored: request values as text, numbers and lists, every rule version 1.</summary>
        private static void NormaliseRules(List<ValidationRule> rules)
        {
            foreach (var rule in rules)
            {
                rule.Value = ToStorable(rule.Value);
                rule.SecondaryValue = ToStorable(rule.SecondaryValue);
                rule.EvaluationVersion = 1;
            }
        }

        /// <summary>Stores the property's rules, or removes its row when there are none; returns the row's id.</summary>
        private async Task<string?> WriteValidationAsync(string schemaId, string fieldName, DataValidation? existing, List<ValidationRule> rules, CancellationToken cancellationToken)
        {
            if (rules.Count == 0)
            {
                if (existing is not null) await ValidationCollection.DeleteOneAsync(x => x.ItemId == existing.ItemId, cancellationToken);
                return existing?.ItemId;
            }

            var validation = existing ?? new DataValidation { ItemId = Guid.NewGuid().ToString(), SchemaId = schemaId, FieldName = fieldName, CreatedDate = DateTime.UtcNow };
            validation.Validations = rules;
            validation.LastUpdatedDate = DateTime.UtcNow;
            await ValidationCollection.ReplaceOneAsync(x => x.ItemId == validation.ItemId, validation, new ReplaceOptions { IsUpsert = true }, cancellationToken);
            return validation.ItemId;
        }

        /// <summary>The requested default as stored; null clears it.</summary>
        private static FieldDefaultValue? StorableDefault(FieldDefaultValue? requested)
        {
            if (requested is null) return null;
            return new FieldDefaultValue
            {
                Kind = requested.Kind,
                Value = ToStorable(requested.Value),
                Offset = requested.Kind == DefaultValueKind.Now ? requested.Offset : null,
            };
        }

        /// <summary>Why the default can't go on the field, or null when it can (clearing always can).</summary>
        private static string? CheckDefault(SchemaDefinition schema, FieldDefinition field, FieldDefaultValue? defaultValue) =>
            defaultValue is null
                ? null
                : FieldDefaultValueCheck.Check(field.Name, field.Type, field.IsArray, field.EnumValues, defaultValue,
                    schema.SchemaName, VariableSyntax.FieldsOf(schema.Fields));

        private object? RuleFlags(string schemaName) =>
            OfferedRules(schemaName) is { } rules
                ? new
                {
                    level = rules.Level.ToString(),
                    fields = rules.Fields.Values.Select(f => new
                    {
                        f.Path,
                        validation = f.Validation.ToString(),
                        @default = f.Default.ToString(),
                        f.DefaultHasNoEffect,
                    }),
                }
                : null;

        /// <summary>The same checks the Data Gateway makes when a rule is saved, with system schemas as Reference targets.</summary>
        private async Task<string?> CheckRulesAsync(SchemaDefinition schema, FieldDefinition field, List<ValidationRule> rules, CancellationToken cancellationToken)
        {
            if (rules.Count(r => r.Type == ValidationType.Reference) > 1) return ReferenceRuleCompatibility.OnlyOneReference;
            var fields = VariableSyntax.FieldsOf(schema.Fields);
            var ruleField = new RuleField(field.Name, field.Type, field.IsArray, field.EnumValues);
            foreach (var rule in rules)
            {
                // System schemas take only the older rule types: no new type, condition, filter or date relative to now.
                // The platform services read these rules and may run an older Genesis.
                var problem = ValidationRuleCheck.Check(rule, ruleField, schema.SchemaName, systemSchema: true, fields).FirstOrDefault()
                    ?? CheckRuleShape(rule)
                    ?? ValidationVariableCheck.Check(rule, field.Type, schema.SchemaName, fields)
                    ?? await CheckReferenceAsync(field, rule, cancellationToken);
                if (problem is not null) return problem;
            }
            return null;
        }

        /// <summary>The rule on its own: a known type, the values it needs, a pattern that parses.</summary>
        private static string? CheckRuleShape(ValidationRule rule)
        {
            if (!Enum.IsDefined(rule.Type)) return "Validation_Type_Must_Be_Valid.";
            if (rule.Type != ValidationType.NotEmpty && rule.Value is null) return "Value_Is_Required_For_This_Validation_Type.";
            if (rule.Type is ValidationType.Range or ValidationType.LengthRange && rule.SecondaryValue is null) return "Secondary_Value_Is_Required_For_Range_Validation.";
            if (rule.Type == ValidationType.Regex && !IsValidPattern(rule.Value?.ToString())) return "Invalid regex pattern";
            return null;
        }

        /// <summary>A Reference rule must point at a system Entity schema and one of its fields that fits.</summary>
        private async Task<string?> CheckReferenceAsync(FieldDefinition field, ValidationRule rule, CancellationToken cancellationToken)
        {
            if (rule.Type != ValidationType.Reference) return null;
            var targetName = ReferenceTargets.TargetSchemaName(rule);
            var target = await SchemaCollection.Find(x => x.SchemaName == targetName && x.IsSystemEntity && !x.IsDeleted).FirstOrDefaultAsync(cancellationToken);
            return ReferenceRuleCompatibility.Check(field, target, ReferenceTargets.TargetFieldName(rule), systemSchemas: true);
        }

        /// <summary>Parses the pattern only (the timeout bounds the parse); nothing is matched here.</summary>
        private static bool IsValidPattern(string? pattern)
        {
            if (string.IsNullOrEmpty(pattern)) return false;
            try
            {
                _ = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromSeconds(1));
                return true;
            }
            catch (ArgumentException)
            {
                return false;
            }
        }

        /// <summary>A platform schema the allow-list opens for rules, with its rule set; null otherwise.</summary>
        private async Task<(SchemaDefinition Schema, SystemSchemaRuleSet Rules)?> LoadRulesSchemaAsync(string schemaId, CancellationToken cancellationToken)
        {
            var schema = await SchemaCollection.Find(x => x.ItemId == schemaId && x.IsSystemEntity && !x.IsDeleted).FirstOrDefaultAsync(cancellationToken);
            return schema is not null && PlatformSchemaCatalog.IsOffered(schema.SchemaName) && OfferedRules(schema.SchemaName) is { } rules
                ? (schema, rules)
                : null;
        }

        /// <summary>JSON request values as stored values: text, numbers, booleans, and lists of them.</summary>
        private static object? ToStorable(object? value)
        {
            if (value is not JsonElement json) return value;
            return json.ValueKind switch
            {
                JsonValueKind.String => json.GetString(),
                JsonValueKind.Number => NumberOf(json),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Array => json.EnumerateArray().Select(item => ToStorable(item)).ToArray(),
                JsonValueKind.Null or JsonValueKind.Undefined => null,
                _ => json.GetRawText(),
            };
        }

        /// <summary>A whole number as a long, anything else as a double.</summary>
        private static object NumberOf(JsonElement json) => json.TryGetInt64(out var whole) ? whole : json.GetDouble();

        /// <summary>The schema's property by name, or null when it doesn't exist or is hidden from this page.</summary>
        private static FieldDefinition? VisibleField(SchemaDefinition schema, string name) =>
            PlatformSchemaCatalog.IsHiddenField(schema.SchemaName, name) ? null : schema.Fields.FirstOrDefault(field => field.Name == name);

        private static bool IsValidPolicyRequest(SavePlatformPolicyRequest request, PolicyOperation operation, PolicyType policyType, SchemaDefinition schema)
        {
            if (string.IsNullOrWhiteSpace(request.PolicyName) || !Operations.Contains(operation)) return false;
            if (PlatformSchemaCatalog.FirstHiddenInRules(schema.SchemaName, request.RuleGroup) is not null) return false;
            if (policyType == PolicyType.RLS) return request.FieldNames.Length == 0;
            if (policyType == PolicyType.CLS)
                return FieldOperations.Contains(operation) && request.FieldNames.Length != 0
                    && request.FieldNames.All(name => VisibleField(schema, name) is not null);
            return true;
        }

        private static void SetAccessLevel(SchemaDefinition schema, PolicyOperation operation, SchemaAccessLevel level)
        {
            switch (operation)
            {
                case PolicyOperation.READ: schema.ReadAccessLevel = level; break;
                case PolicyOperation.WRITE: schema.WriteAccessLevel = level; break;
                case PolicyOperation.EDIT: schema.EditAccessLevel = level; break;
                case PolicyOperation.DELETE: schema.DeleteAccessLevel = level; break;
            }
        }

        private static void SetAccessLevel(FieldDefinition field, PolicyOperation operation, SchemaAccessLevel level)
        {
            if (operation == PolicyOperation.READ) field.ReadAccessLevel = level;
            else if (operation == PolicyOperation.EDIT) field.EditAccessLevel = level;
        }

        private async Task<DataAccessPolicy?> LoadOrCreatePolicyAsync(string? itemId, SchemaDefinition schema, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(itemId))
                return new DataAccessPolicy { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow };
            return await PolicyCollection.Find(x => x.ItemId == itemId && x.SchemaId == schema.ItemId && Operations.Contains(x.Operation))
                .FirstOrDefaultAsync(cancellationToken);
        }

        private async Task<bool> IsPlatformSchemaAsync(string schemaId, CancellationToken cancellationToken)
        {
            var schema = await SchemaCollection.Find(x => x.ItemId == schemaId && x.IsSystemEntity && !x.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            return schema is not null && PlatformSchemaCatalog.IsOffered(schema.SchemaName);
        }

        private IMongoDatabase Database => databaseProvider.GetDatabase() ?? throw new InvalidOperationException("Tenant database is unavailable.");
        private IMongoCollection<SchemaDefinition> SchemaCollection => Database.GetCollection<SchemaDefinition>("SchemaDefinitions");
        private IMongoCollection<DataAccessPolicy> PolicyCollection => Database.GetCollection<DataAccessPolicy>("DataAccessPolicys");
        private IMongoCollection<DataValidation> ValidationCollection => Database.GetCollection<DataValidation>("DataValidations");
    }
}
