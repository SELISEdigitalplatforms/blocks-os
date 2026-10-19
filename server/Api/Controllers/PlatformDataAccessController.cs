using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Evaluation;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using MongoDB.Driver;

namespace BlocksOs.Api.Controllers;

[ApiController]
[Route("[controller]/[action]")]
public sealed class PlatformDataAccessController(IDbContextProvider databaseProvider, IConfiguration? configuration = null) : ControllerBase
{
    private const string LogicService = "Logic";

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

    // View, Create, Edit and Delete, as the services check them. ALL is left out: services never ask for it.
    private static readonly PolicyOperation[] Operations = [PolicyOperation.READ, PolicyOperation.WRITE, PolicyOperation.EDIT, PolicyOperation.DELETE];

    // Field rules the services apply: Genesis derives column rules for READ and EDIT only.
    private static readonly PolicyOperation[] FieldOperations = [PolicyOperation.READ, PolicyOperation.EDIT];

    private static readonly IReadOnlyDictionary<string, string> Owners = new Dictionary<string, string>
    {
        ["User"] = "IAM", ["Role"] = "IAM", ["Permission"] = "IAM", ["Organization"] = "IAM",
        ["UserKeyMap"] = "IAM", ["IdentityConfiguration"] = "IAM", ["IdentityProvider"] = "IAM",
        ["ClientCredential"] = "IAM", ["OidcClientRegistration"] = "IAM", ["RefreshTokenModel"] = "IAM",
        ["IdpSessionModel"] = "IAM", ["TokenRevocationModel"] = "IAM", ["DeviceAuthorizationRequestModel"] = "IAM",
        ["SignupLink"] = "IAM", ["SignupLinkConfiguration"] = "IAM", ["UserActivity"] = "IAM",
        ["UserTotpDetail"] = "IAM", ["ImpersonationSession"] = "IAM", ["BiometricCredential"] = "IAM",
        ["BlocksClientConfig"] = "IAM", ["Secret"] = "IAM",
        ["EmailTemplate"] = "OS", ["IntegrationSetup"] = "OS", ["ThirdPartyJWTClaims"] = "OS",
        ["MailServerConfiguration"] = "OS", ["ResourceLimit"] = "OS", ["MigrationTracker"] = "OS",
        ["WorkflowEntity"] = LogicService, ["WorkflowVersionEntity"] = LogicService, ["WorkflowExecutionEntity"] = LogicService,
        ["WorkflowItemExecutionEntity"] = LogicService, ["FunctionEntity"] = LogicService, ["FunctionVersionEntity"] = LogicService,
        ["FunctionRunEntity"] = LogicService, ["FunctionRunLogEntity"] = LogicService, ["FunctionBuildEntity"] = LogicService,
        ["FunctionAuditEventEntity"] = LogicService, ["ProxyDetailEntity"] = LogicService, ["ProxyVersionEntity"] = LogicService,
        ["ProxyExecutionEntity"] = LogicService, ["Schedule"] = LogicService, ["MailBoxEntity"] = LogicService,
        ["MailBoxSyncCursor"] = LogicService, ["NotificationConnection"] = LogicService, ["NotificationSubscription"] = LogicService,
        ["OfflineNotification"] = LogicService, ["FirebaseConfiguration"] = LogicService,
        ["Build"] = "Release", ["Repo"] = "Release", ["RepositoryWebhook"] = "Release"
    };

    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-access::get-data-access-policy")]
    public async Task<IActionResult> Schemas(CancellationToken cancellationToken)
    {
        var schemas = await SchemaCollection.Find(x => x.IsSystemEntity && !x.IsDeleted).ToListAsync(cancellationToken);
        var rulesEnabled = RulesEnabled;
        var validations = rulesEnabled
            ? await ValidationCollection.Find(x => !x.IsDeleted).ToListAsync(cancellationToken)
            : [];
        var result = schemas.Where(x => Owners.ContainsKey(x.SchemaName)).Select(x => new
        {
            id = x.ItemId,
            x.SchemaName,
            x.CollectionName,
            service = Owners[x.SchemaName],
            // All four levels, one per access tab in the console.
            readAccessLevel = (int)x.ReadAccessLevel,
            writeAccessLevel = (int)x.WriteAccessLevel,
            editAccessLevel = (int)x.EditAccessLevel,
            deleteAccessLevel = (int)x.DeleteAccessLevel,
            fields = FieldDefinitionMapper.GetFieldDefinitionResponses(x.Fields, [], validations.Where(v => v.SchemaId == x.ItemId).ToList()),
            // Which properties take validation rules and defaults (the Genesis allow-list); null when none do or rules are off.
            rules = rulesEnabled ? RuleFlags(x.SchemaName) : null
        }).OrderBy(x => x.service).ThenBy(x => x.SchemaName).ToList();
        return Ok(new { isSuccess = true, data = result });
    }

    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-access::get-data-access-policy")]
    public async Task<IActionResult> Policies([FromQuery] string schemaId, CancellationToken cancellationToken)
    {
        if (!await IsPlatformSchemaAsync(schemaId, cancellationToken)) return NotFound();
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
        return Ok(new { isSuccess = true, data = result });
    }

    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-access::create-data-access-policy")]
    public Task<IActionResult> Create([FromBody] SavePlatformPolicyRequest request, CancellationToken cancellationToken) =>
        SaveAsync(request, null, cancellationToken);

    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-access::configure-security")]
    public async Task<IActionResult> Configure([FromBody] ConfigurePlatformAccessRequest request, CancellationToken cancellationToken)
    {
        var schema = await SchemaCollection.Find(x => x.ItemId == request.SchemaId && x.IsSystemEntity && !x.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);
        if (schema is null || !Owners.ContainsKey(schema.SchemaName) || request.Operation is not { } operation || !Operations.Contains(operation)) return BadRequest();
        var accessLevel = request.AccessLevel ?? default;
        if ((request.PolicyType ?? default) == PolicyType.RLS) SetAccessLevel(schema, operation, accessLevel);
        else
        {
            if (!FieldOperations.Contains(operation) || request.FieldNames.Length == 0
                || request.FieldNames.Any(name => schema.Fields.All(field => field.Name != name))) return BadRequest();
            foreach (var field in schema.Fields.Where(field => request.FieldNames.Contains(field.Name))) SetAccessLevel(field, operation, accessLevel);
        }
        await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId = schema.ItemId } });
    }

    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-access::update-data-access-policy")]
    public Task<IActionResult> Update([FromBody] SavePlatformPolicyRequest request, CancellationToken cancellationToken) =>
        SaveAsync(request, request.ItemId, cancellationToken);

    [HttpDelete]
    [ProtectedEndPoint("blocks-data::data-access::delete-data-access-policy")]
    public async Task<IActionResult> Delete([FromQuery] string itemId, CancellationToken cancellationToken)
    {
        var policy = await PolicyCollection.Find(x => x.ItemId == itemId && Operations.Contains(x.Operation)).FirstOrDefaultAsync(cancellationToken);
        if (policy is null || !await IsPlatformSchemaAsync(policy.SchemaId, cancellationToken)) return NotFound();
        await PolicyCollection.DeleteOneAsync(x => x.ItemId == itemId, cancellationToken);
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId } });
    }

    /// <summary>The field's validation rules; null when it has none.</summary>
    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-validation::get-validation-by-schema-and-field")]
    public async Task<IActionResult> Validation([FromQuery] string schemaId, [FromQuery] string fieldName, CancellationToken cancellationToken)
    {
        if (!RulesEnabled || await LoadRulesSchemaAsync(schemaId, cancellationToken) is null) return NotFound();
        var validation = await ValidationCollection.Find(x => x.SchemaId == schemaId && x.FieldName == fieldName && !x.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);
        return Ok(new { isSuccess = true, data = validation is null ? null : new { validation.ItemId, validation.Validations } });
    }

    /// <summary>
    /// Replaces the field's validation rules; an empty list removes them. Only properties the Genesis allow-list
    /// opens; Reference rules point at system Entity schemas; every rule is saved as version 1.
    /// </summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-data::data-validation::update-data-validation")]
    public async Task<IActionResult> SaveValidation([FromBody] SavePlatformValidationRequest request, CancellationToken cancellationToken)
    {
        if (!RulesEnabled || await LoadRulesSchemaAsync(request.SchemaId, cancellationToken) is not { } loaded) return NotFound();
        var (schema, rules) = loaded;
        var field = schema.Fields.FirstOrDefault(f => f.Name == request.FieldName);
        if (field is null || rules.ValidationFor(field.Name) == RuleAccess.Blocked)
            return Refused(request.FieldName, $"Validation rules can't be set on {schema.SchemaName}.{request.FieldName}");

        foreach (var rule in request.Validations)
        {
            rule.Value = ToStorable(rule.Value);
            rule.SecondaryValue = ToStorable(rule.SecondaryValue);
            rule.EvaluationVersion = 1;
        }
        if (await CheckRulesAsync(schema, field, request.Validations, cancellationToken) is { } problem)
            return Refused(request.FieldName, problem);

        var existing = await ValidationCollection.Find(x => x.SchemaId == schema.ItemId && x.FieldName == field.Name && !x.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);
        if (request.Validations.Count == 0)
        {
            if (existing is not null) await ValidationCollection.DeleteOneAsync(x => x.ItemId == existing.ItemId, cancellationToken);
            return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId = existing?.ItemId } });
        }

        var validation = existing ?? new DataValidation { ItemId = Guid.NewGuid().ToString(), SchemaId = schema.ItemId, FieldName = field.Name, CreatedDate = DateTime.UtcNow };
        validation.Validations = request.Validations;
        validation.LastUpdatedDate = DateTime.UtcNow;
        await ValidationCollection.ReplaceOneAsync(x => x.ItemId == validation.ItemId, validation, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId = validation.ItemId } });
    }

    /// <summary>Sets or (null) clears the field's default value. Only properties the Genesis allow-list opens.</summary>
    [HttpPost]
    [ProtectedEndPoint("blocks-data::schema::save-schema-fields")]
    public async Task<IActionResult> FieldDefault([FromBody] SetPlatformFieldDefaultRequest request, CancellationToken cancellationToken)
    {
        if (!RulesEnabled || await LoadRulesSchemaAsync(request.SchemaId, cancellationToken) is not { } loaded) return NotFound();
        var (schema, rules) = loaded;
        var field = schema.Fields.FirstOrDefault(f => f.Name == request.FieldName);
        if (field is null || rules.DefaultFor(field.Name) == RuleAccess.Blocked)
            return Refused(request.FieldName, $"A default value can't be set on {schema.SchemaName}.{request.FieldName}");

        FieldDefaultValue? defaultValue = null;
        if (request.DefaultValue is { } requested)
        {
            defaultValue = new FieldDefaultValue
            {
                Kind = requested.Kind,
                Value = ToStorable(requested.Value),
                Offset = requested.Kind == DefaultValueKind.Now ? requested.Offset : null,
            };
            var problem = FieldDefaultValueCheck.Check(field.Name, field.Type, field.IsArray, field.EnumValues, defaultValue,
                schema.SchemaName, VariableSyntax.FieldsOf(schema.Fields));
            if (problem is not null) return Refused(request.FieldName, problem);
        }

        field.DefaultValue = defaultValue;
        await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId = schema.ItemId } });
    }

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
        foreach (var rule in rules)
        {
            var problem = CheckRuleShape(rule)
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

    private BadRequestObjectResult Refused(string fieldName, string message) =>
        BadRequest(new BaseResponse { IsSuccess = false, Errors = new Dictionary<string, string> { [string.IsNullOrEmpty(fieldName) ? "fieldName" : fieldName] = message } });

    /// <summary>A platform schema the allow-list opens for rules, with its rule set; null otherwise.</summary>
    private async Task<(SchemaDefinition Schema, SystemSchemaRuleSet Rules)?> LoadRulesSchemaAsync(string schemaId, CancellationToken cancellationToken)
    {
        var schema = await SchemaCollection.Find(x => x.ItemId == schemaId && x.IsSystemEntity && !x.IsDeleted).FirstOrDefaultAsync(cancellationToken);
        return schema is not null && Owners.ContainsKey(schema.SchemaName) && OfferedRules(schema.SchemaName) is { } rules
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

    private async Task<IActionResult> SaveAsync(SavePlatformPolicyRequest request, string? itemId, CancellationToken cancellationToken)
    {
        var schema = await SchemaCollection.Find(x => x.ItemId == request.SchemaId && x.IsSystemEntity && !x.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);
        if (schema is null || !Owners.ContainsKey(schema.SchemaName)) return NotFound();
        var policyType = request.PolicyType ?? default;
        if (request.Operation is not { } operation || !IsValidPolicyRequest(request, operation, policyType, schema)) return BadRequest();

        var policy = await LoadOrCreatePolicyAsync(itemId, schema, cancellationToken);
        if (policy is null) return NotFound();

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
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId = policy.ItemId } });
    }

    private static bool IsValidPolicyRequest(SavePlatformPolicyRequest request, PolicyOperation operation, PolicyType policyType, SchemaDefinition schema)
    {
        if (string.IsNullOrWhiteSpace(request.PolicyName) || !Operations.Contains(operation)) return false;
        if (policyType == PolicyType.RLS) return request.FieldNames.Length == 0;
        if (policyType == PolicyType.CLS)
            return FieldOperations.Contains(operation) && request.FieldNames.Length != 0
                && request.FieldNames.All(name => schema.Fields.Any(field => field.Name == name));
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
        return schema is not null && Owners.ContainsKey(schema.SchemaName);
    }

    private IMongoDatabase Database => databaseProvider.GetDatabase() ?? throw new InvalidOperationException("Tenant database is unavailable.");
    private IMongoCollection<SchemaDefinition> SchemaCollection => Database.GetCollection<SchemaDefinition>("SchemaDefinitions");
    private IMongoCollection<DataAccessPolicy> PolicyCollection => Database.GetCollection<DataAccessPolicy>("DataAccessPolicys");
    private IMongoCollection<DataValidation> ValidationCollection => Database.GetCollection<DataValidation>("DataValidations");
}

public sealed class SavePlatformPolicyRequest
{
    public string? ItemId { get; set; }
    public string SchemaId { get; set; } = string.Empty;
    public string PolicyName { get; set; } = string.Empty;
    public string? PolicyDescription { get; set; }
    public PolicyOperation? Operation { get; set; }
    public PolicyType? PolicyType { get; set; }
    public string[] FieldNames { get; set; } = [];
    public PolicyRuleGroup RuleGroup { get; set; } = new();
    public int? Priority { get; set; }
    public bool? IsAllowPolicy { get; set; }
}

public sealed class ConfigurePlatformAccessRequest
{
    public string SchemaId { get; set; } = string.Empty;
    public PolicyOperation? Operation { get; set; }
    public PolicyType? PolicyType { get; set; }
    public string[] FieldNames { get; set; } = [];
    public SchemaAccessLevel? AccessLevel { get; set; }
}

public sealed class SavePlatformValidationRequest
{
    public string SchemaId { get; set; } = string.Empty;
    /// <summary>The property; a nested one by its dotted path, e.g. Read.Roles.</summary>
    public string FieldName { get; set; } = string.Empty;
    public List<ValidationRule> Validations { get; set; } = [];
}

public sealed class SetPlatformFieldDefaultRequest
{
    public string SchemaId { get; set; } = string.Empty;
    /// <summary>The property; a nested one by its dotted path, e.g. Read.Roles.</summary>
    public string FieldName { get; set; } = string.Empty;
    /// <summary>Null clears the default.</summary>
    public FieldDefaultValue? DefaultValue { get; set; }
}
