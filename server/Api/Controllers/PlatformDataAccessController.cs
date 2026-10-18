using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Evaluation;
using Blocks.Genesis.Entities.Data;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace BlocksOs.Api.Controllers;

[ApiController]
[Route("[controller]/[action]")]
public sealed class PlatformDataAccessController(IDbContextProvider databaseProvider) : ControllerBase
{
    private const string LogicService = "Logic";

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
        var result = schemas.Where(x => Owners.ContainsKey(x.SchemaName)).Select(x => new
        {
            id = x.ItemId,
            x.SchemaName,
            x.CollectionName,
            service = Owners[x.SchemaName],
            // All four levels, so the console can show View/Create/Delete next to the editable Edit.
            readAccessLevel = (int)x.ReadAccessLevel,
            writeAccessLevel = (int)x.WriteAccessLevel,
            editAccessLevel = (int)x.EditAccessLevel,
            deleteAccessLevel = (int)x.DeleteAccessLevel,
            fields = FieldDefinitionMapper.GetFieldDefinitionResponses(x.Fields, [], [])
        }).OrderBy(x => x.service).ThenBy(x => x.SchemaName).ToList();
        return Ok(new { isSuccess = true, data = result });
    }

    [HttpGet]
    [ProtectedEndPoint("blocks-data::data-access::get-data-access-policy")]
    public async Task<IActionResult> Policies([FromQuery] string schemaId, CancellationToken cancellationToken)
    {
        if (!await IsPlatformSchemaAsync(schemaId, cancellationToken)) return NotFound();
        var policies = await PolicyCollection.Find(x => x.SchemaId == schemaId && !x.IsDeleted && x.Operation == PolicyOperation.EDIT)
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
        if (schema is null || !Owners.ContainsKey(schema.SchemaName) || (request.Operation ?? default) != PolicyOperation.EDIT) return BadRequest();
        var accessLevel = request.AccessLevel ?? default;
        if ((request.PolicyType ?? default) == PolicyType.RLS) schema.EditAccessLevel = accessLevel;
        else
        {
            if (request.FieldNames.Length == 0 || request.FieldNames.Any(name => schema.Fields.All(field => field.Name != name))) return BadRequest();
            foreach (var field in schema.Fields.Where(field => request.FieldNames.Contains(field.Name))) field.EditAccessLevel = accessLevel;
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
        var policy = await PolicyCollection.Find(x => x.ItemId == itemId && x.Operation == PolicyOperation.EDIT).FirstOrDefaultAsync(cancellationToken);
        if (policy is null || !await IsPlatformSchemaAsync(policy.SchemaId, cancellationToken)) return NotFound();
        await PolicyCollection.DeleteOneAsync(x => x.ItemId == itemId, cancellationToken);
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId } });
    }

    private async Task<IActionResult> SaveAsync(SavePlatformPolicyRequest request, string? itemId, CancellationToken cancellationToken)
    {
        var schema = await SchemaCollection.Find(x => x.ItemId == request.SchemaId && x.IsSystemEntity && !x.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);
        if (schema is null || !Owners.ContainsKey(schema.SchemaName)) return NotFound();
        var policyType = request.PolicyType ?? default;
        if (!IsValidPolicyRequest(request, policyType, schema)) return BadRequest();

        var policy = await LoadOrCreatePolicyAsync(itemId, schema, cancellationToken);
        if (policy is null) return NotFound();

        policy.PolicyName = request.PolicyName.Trim();
        policy.PolicyDescription = request.PolicyDescription ?? string.Empty;
        policy.PolicyType = policyType;
        policy.Operation = PolicyOperation.EDIT;
        policy.SchemaName = schema.SchemaName;
        policy.SchemaId = schema.ItemId;
        policy.FieldNames = request.FieldNames;
        policy.RuleGroup = request.RuleGroup;
        policy.Priority = request.Priority ?? 1;
        policy.IsAllowPolicy = request.IsAllowPolicy ?? true;
        policy.LastUpdatedDate = DateTime.UtcNow;

        if (policyType == PolicyType.RLS) schema.EditAccessLevel = SchemaAccessLevel.Custom;
        else foreach (var field in schema.Fields.Where(field => request.FieldNames.Contains(field.Name))) field.EditAccessLevel = SchemaAccessLevel.Custom;

        await SchemaCollection.ReplaceOneAsync(x => x.ItemId == schema.ItemId, schema, cancellationToken: cancellationToken);
        await PolicyCollection.ReplaceOneAsync(x => x.ItemId == policy.ItemId, policy, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return Ok(new { isSuccess = true, data = new { acknowledged = true, itemId = policy.ItemId } });
    }

    private static bool IsValidPolicyRequest(SavePlatformPolicyRequest request, PolicyType policyType, SchemaDefinition schema)
    {
        if (string.IsNullOrWhiteSpace(request.PolicyName)) return false;
        if (policyType == PolicyType.RLS) return request.FieldNames.Length == 0;
        if (policyType == PolicyType.CLS) return request.FieldNames.Length != 0 && request.FieldNames.All(name => schema.Fields.Any(field => field.Name == name));
        return true;
    }

    private async Task<DataAccessPolicy?> LoadOrCreatePolicyAsync(string? itemId, SchemaDefinition schema, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(itemId))
            return new DataAccessPolicy { ItemId = Guid.NewGuid().ToString(), CreatedDate = DateTime.UtcNow };
        return await PolicyCollection.Find(x => x.ItemId == itemId && x.SchemaId == schema.ItemId && x.Operation == PolicyOperation.EDIT)
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
}

public sealed class SavePlatformPolicyRequest
{
    public string? ItemId { get; set; }
    public string SchemaId { get; set; } = string.Empty;
    public string PolicyName { get; set; } = string.Empty;
    public string? PolicyDescription { get; set; }
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
