using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Data;
using BlocksOs.Api.Controllers;
using Configuration.DomainService.DataGateway.RequestModel;
using Configuration.DomainService.DataGateway.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using MongoDB.Bson;
using MongoDB.Driver;
using Xunit;

namespace XUnitTest.Integration;

/// <summary>
/// The Data Access page's Validation and Default value buttons: only behind PlatformDataAccess:RulesEnabled,
/// only on what the Genesis allow-list opens, with the same checks the Data Gateway makes.
/// </summary>
[Collection(MongoIntegrationCollection.Name)]
public class PlatformSchemaRulesControllerTests
{
    private readonly MongoIntegrationFixture _fixture;

    public PlatformSchemaRulesControllerTests(MongoIntegrationFixture fixture) => _fixture = fixture;

    private PlatformDataAccessController Controller(bool rulesEnabled = true, bool includeWarned = true) => new(new PlatformDataAccessService(_fixture.DbContextProvider,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [PlatformDataAccessService.RulesEnabledSetting] = rulesEnabled.ToString(),
            [PlatformDataAccessService.RulesIncludeWarnedSetting] = includeWarned.ToString(),
        }).Build()));

    private IMongoCollection<SchemaDefinition> Schemas => _fixture.Collection<SchemaDefinition>("SchemaDefinitions");
    private IMongoCollection<DataValidation> Validations => _fixture.Collection<DataValidation>("DataValidations");

    private async Task<string> InsertAsync(string schemaName, params string[] fields)
    {
        var id = Guid.NewGuid().ToString();
        await Schemas.InsertOneAsync(new SchemaDefinition
        {
            ItemId = id, SchemaName = schemaName, CollectionName = schemaName + "s", SchemaType = SchemaType.Entity, IsSystemEntity = true,
            // Tags and the access lists (Read.Roles, …) are lists of text, as the seed has them.
            Fields = fields.Select(f => new FieldDefinition { Name = f, Type = "String", IsArray = f == "Tags" || f.Contains('.') }).ToList(),
        });
        return id;
    }

    private Task<string> InsertEmailTemplateAsync() => InsertAsync("EmailTemplate", "Name", "TemplateSubject", "ImageUrl", "MailConfigurationId", "Tags");

    private static string Message(IActionResult result) =>
        result.Should().BeOfType<BadRequestObjectResult>().Subject.Value.Should().BeOfType<BaseResponse>().Subject.Errors!.Values.Single();

    private static SavePlatformValidationRequest Rules(string schemaId, string field, params ValidationRule[] rules) =>
        new() { SchemaId = schemaId, FieldName = field, Validations = rules.ToList() };

    [Fact]
    public async Task WhileTheSwitchIsOff_RuleEndpointsAnswer404_AndSchemasCarryNoFlags()
    {
        var id = await InsertEmailTemplateAsync();
        var off = Controller(rulesEnabled: false);

        (await off.Validation(id, "TemplateSubject", CancellationToken.None)).Should().BeOfType<NotFoundResult>();
        (await off.SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.NotEmpty }), CancellationToken.None))
            .Should().BeOfType<NotFoundResult>();
        (await off.FieldDefault(new SetPlatformFieldDefaultRequest { SchemaId = id, FieldName = "ImageUrl" }, CancellationToken.None))
            .Should().BeOfType<NotFoundResult>();

        var schema = await SchemaRowAsync(off, id);
        schema.GetProperty("rules").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Schemas_CarriesTheAllowList_AndEachFieldsRules()
    {
        var id = await InsertEmailTemplateAsync();
        await Controller().SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 80 }), CancellationToken.None);

        var schema = await SchemaRowAsync(Controller(), id);

        var rules = schema.GetProperty("rules");
        rules.GetProperty("level").GetString().Should().Be("Normal");
        var subject = rules.GetProperty("fields").EnumerateArray().Single(f => f.GetProperty("Path").GetString() == "TemplateSubject");
        subject.GetProperty("validation").GetString().Should().Be("Allowed");
        subject.GetProperty("default").GetString().Should().Be("Allowed");
        rules.GetProperty("fields").EnumerateArray().Should().NotContain(f => f.GetProperty("Path").GetString() == "MailConfigurationId");

        var field = schema.GetProperty("fields").EnumerateArray().Single(f => f.GetProperty("Name").GetString() == "TemplateSubject");
        field.GetProperty("ValidationRule").GetProperty("Validations").EnumerateArray().Single().GetProperty("Type").GetInt32()
            .Should().Be((int)ValidationType.MaxLength);
    }

    [Fact]
    public async Task Schemas_ReadsOnlySystemSchemasRules_SoATenantRuleOfAnUnknownTypeCantBreakIt()
    {
        var id = await InsertEmailTemplateAsync();
        await Controller().SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 80 }), CancellationToken.None);
        // A tenant schema's rule of a type this Genesis doesn't know, as a newer gateway stores one (e.g. In).
        var tenantSchema = Guid.NewGuid().ToString();
        await _fixture.Collection<BsonDocument>("DataValidations").InsertOneAsync(new BsonDocument
        {
            ["_id"] = Guid.NewGuid().ToString(), ["SchemaId"] = tenantSchema, ["FieldName"] = "Status", ["IsDeleted"] = false,
            ["Validations"] = new BsonArray { new BsonDocument { ["Type"] = "FutureType", ["Value"] = new BsonArray { "Open" }, ["IsActive"] = true } },
        });
        await FluentActions.Awaiting(() => Validations.Find(v => v.SchemaId == tenantSchema).ToListAsync())
            .Should().ThrowAsync<Exception>("the tenant rule must be unreadable here for this test to mean anything");

        var body = JsonSerializer.SerializeToElement((await Controller().Schemas(CancellationToken.None)).Should().BeOfType<OkObjectResult>().Subject.Value);

        var rows = body.GetProperty("data").EnumerateArray().ToList();
        rows.Should().NotContain(s => s.GetProperty("id").GetString() == tenantSchema);
        var field = rows.Single(s => s.GetProperty("id").GetString() == id).GetProperty("fields").EnumerateArray()
            .Single(f => f.GetProperty("Name").GetString() == "TemplateSubject");
        field.GetProperty("ValidationRule").GetProperty("Validations").EnumerateArray().Single().GetProperty("Type").GetInt32()
            .Should().Be((int)ValidationType.MaxLength);
    }

    [Fact]
    public async Task SaveValidation_StoresVersionOneRules_AndAnEmptyListRemovesThem()
    {
        var id = await InsertEmailTemplateAsync();
        var controller = Controller();

        (await controller.SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 80 }), CancellationToken.None))
            .Should().BeOfType<OkObjectResult>();
        var saved = await Validations.Find(v => v.SchemaId == id && v.FieldName == "TemplateSubject").SingleAsync();
        saved.Validations.Single().EvaluationVersion.Should().Be(1);

        await controller.SaveValidation(Rules(id, "TemplateSubject"), CancellationToken.None);
        (await Validations.CountDocumentsAsync(v => v.SchemaId == id)).Should().Be(0);
    }

    [Fact]
    public async Task SaveValidation_RefusesWhatTheAllowListKeepsClosed()
    {
        var id = await InsertEmailTemplateAsync();
        var excluded = await InsertAsync("RefreshTokenModel", "Scope");
        var notEmpty = new ValidationRule { Type = ValidationType.NotEmpty };

        Message(await Controller().SaveValidation(Rules(id, "MailConfigurationId", notEmpty), CancellationToken.None))
            .Should().Be("Validation rules can't be set on EmailTemplate.MailConfigurationId");
        (await Controller().SaveValidation(Rules(excluded, "Scope", notEmpty), CancellationToken.None)).Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task SchemasOutsideTheDataAccessList_AreNotFound()
    {
        // A system schema no platform service owns here, and a tenant's own schema that shares a system name.
        var unowned = await InsertAsync("Tenant", "Name");
        var tenantOwn = Guid.NewGuid().ToString();
        await Schemas.InsertOneAsync(new SchemaDefinition
        {
            ItemId = tenantOwn, SchemaName = "EmailTemplate", CollectionName = "EmailTemplates", SchemaType = SchemaType.Entity, IsSystemEntity = false,
            Fields = [new FieldDefinition { Name = "TemplateSubject", Type = "String" }],
        });
        var notEmpty = new ValidationRule { Type = ValidationType.NotEmpty };

        (await Controller().SaveValidation(Rules(unowned, "Name", notEmpty), CancellationToken.None)).Should().BeOfType<NotFoundResult>();
        (await Controller().SaveValidation(Rules(tenantOwn, "TemplateSubject", notEmpty), CancellationToken.None)).Should().BeOfType<NotFoundResult>();
        (await Controller().FieldDefault(new SetPlatformFieldDefaultRequest { SchemaId = tenantOwn, FieldName = "TemplateSubject" }, CancellationToken.None))
            .Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task SaveValidation_ReferencesPointAtSystemEntities_AndVariablesAreChecked()
    {
        var id = await InsertEmailTemplateAsync();
        await InsertAsync("Role", "Name", "Slug");
        var controller = Controller();

        (await controller.SaveValidation(Rules(id, "Tags", new ValidationRule { Type = ValidationType.Reference, Value = "Role" }), CancellationToken.None))
            .Should().BeOfType<OkObjectResult>();
        Message(await controller.SaveValidation(Rules(id, "Tags", new ValidationRule { Type = ValidationType.Reference, Value = "Employee" }), CancellationToken.None))
            .Should().Be(ReferenceRuleCompatibility.TargetSchemaMustBeEntity);
        Message(await controller.SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.Equal, Value = "{{EmailTemplate.Nme}}" }), CancellationToken.None))
            .Should().Be("Unknown property \"EmailTemplate.Nme\" at position 1 (did you mean EmailTemplate.Name?)");
        Message(await controller.SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.Regex, Value = "^[a-z" }), CancellationToken.None))
            .Should().Be("Invalid regex pattern");
    }

    [Fact]
    public async Task SaveValidation_RefusesTheNewerRules_SystemSchemasTakeOnlyTheOlderOnes()
    {
        var id = await InsertEmailTemplateAsync();
        var controller = Controller();
        var onlyWhen = new PolicyRuleGroup
        {
            Rules = [new PolicyRule { LeftSource = ConditionSource.SCHEMA_FIELD, LeftOperand = "Name", Operator = PolicyOperator.EQUAL, RightSource = ConditionSource.STATIC_VALUE, StaticValue = "Welcome" }],
        };

        foreach (var (field, rule) in new (string, ValidationRule)[]
        {
            ("TemplateSubject", new ValidationRule { Type = ValidationType.In, Value = new List<object?> { "Hi" } }),
            ("Tags", new ValidationRule { Type = ValidationType.UniqueItems }),
            ("TemplateSubject", new ValidationRule { Type = ValidationType.NotEmpty, When = onlyWhen }),
            ("TemplateSubject", new ValidationRule { Type = ValidationType.NotExistsIn, Value = "Role" }),
        })
            Message(await controller.SaveValidation(Rules(id, field, rule), CancellationToken.None)).Should().Be(ValidationRuleCheck.NotOnSystemSchemas);

        (await Validations.CountDocumentsAsync(v => v.SchemaId == id)).Should().Be(0);
        (await controller.SaveValidation(Rules(id, "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 80 }), CancellationToken.None))
            .Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task FieldDefault_SetsAndClears_OnlyWhereAllowed()
    {
        var id = await InsertEmailTemplateAsync();
        var controller = Controller();
        SetPlatformFieldDefaultRequest Default(string field, FieldDefaultValue? value) => new() { SchemaId = id, FieldName = field, DefaultValue = value };
        var template = new FieldDefaultValue { Kind = DefaultValueKind.Template, Value = "https://cdn/{{EmailTemplate.Name}}.png" };

        (await controller.FieldDefault(Default("ImageUrl", template), CancellationToken.None)).Should().BeOfType<OkObjectResult>();
        (await StoredFieldAsync(id, "ImageUrl")).DefaultValue!.Value.Should().Be("https://cdn/{{EmailTemplate.Name}}.png");

        // Name takes validation rules but no default; a broken template is refused with its position.
        Message(await controller.FieldDefault(Default("Name", template), CancellationToken.None))
            .Should().Be("A default value can't be set on EmailTemplate.Name");
        Message(await controller.FieldDefault(Default("ImageUrl", new FieldDefaultValue { Kind = DefaultValueKind.Template, Value = "{{EmailTemplate.Name}" }), CancellationToken.None))
            .Should().Be("Unclosed variable at position 1: expected \"}}\"");

        await controller.FieldDefault(Default("ImageUrl", null), CancellationToken.None);
        (await StoredFieldAsync(id, "ImageUrl")).DefaultValue.Should().BeNull();
    }

    private async Task<List<ValidationRule>> StoredRulesAsync(string schemaId, string field) =>
        (await Validations.Find(v => v.SchemaId == schemaId && v.FieldName == field).SingleOrDefaultAsync())?.Validations ?? [];

    [Fact]
    public async Task BulkValidation_AddsToEachDefaultPropertysRules_OrReplacesThem()
    {
        var template = await InsertAsync("EmailTemplate", "Name", "Language", "Read.Roles");
        var role = await InsertAsync("Role", "Name", "Language", "Read.Roles");
        var controller = Controller();
        await controller.SaveValidation(Rules(template, "Language", new ValidationRule { Type = ValidationType.MaxLength, Value = 5 }), CancellationToken.None);
        BulkPlatformValidationRequest Bulk(bool replace, params ValidationRule[] rules) =>
            new() { SchemaIds = [template, role], FieldNames = ["Language", "Read.Roles"], Validations = rules.ToList(), Replace = replace };

        (await controller.BulkValidation(Bulk(false, new ValidationRule { Type = ValidationType.NotEmpty }), CancellationToken.None))
            .Should().BeOfType<OkObjectResult>();
        (await StoredRulesAsync(template, "Language")).Select(r => r.Type).Should().Equal(ValidationType.MaxLength, ValidationType.NotEmpty);
        (await StoredRulesAsync(role, "Read.Roles")).Should().ContainSingle(r => r.Type == ValidationType.NotEmpty && r.EvaluationVersion == 1);

        await controller.BulkValidation(Bulk(true, new ValidationRule { Type = ValidationType.MinLength, Value = 2 }), CancellationToken.None);
        foreach (var (schema, field) in new[] { (template, "Language"), (template, "Read.Roles"), (role, "Language"), (role, "Read.Roles") })
            (await StoredRulesAsync(schema, field)).Select(r => r.Type).Should().Equal(ValidationType.MinLength);

        // Replacing with no rules removes them everywhere.
        await controller.BulkValidation(Bulk(true), CancellationToken.None);
        (await Validations.CountDocumentsAsync(v => v.SchemaId == template || v.SchemaId == role)).Should().Be(0);
    }

    [Fact]
    public async Task BulkValidation_TakesOnlyDefaultProperties_AndWritesNothingWhenAPairIsRefused()
    {
        var template = await InsertAsync("EmailTemplate", "Name", "Language");
        var excluded = await InsertAsync("RefreshTokenModel", "Language");
        var notEmpty = new ValidationRule { Type = ValidationType.NotEmpty };

        Message(await Controller().BulkValidation(new BulkPlatformValidationRequest { SchemaIds = [template], FieldNames = ["Name"], Validations = [notEmpty] }, CancellationToken.None))
            .Should().Be("Name isn't a default property; bulk changes only take the base entity's properties");

        var refused = await Controller().BulkValidation(
            new BulkPlatformValidationRequest { SchemaIds = [template, excluded], FieldNames = ["Language"], Validations = [notEmpty] }, CancellationToken.None);
        refused.Should().BeOfType<BadRequestObjectResult>().Subject.Value.Should().BeOfType<BaseResponse>().Subject.Errors
            .Should().ContainKey(excluded).WhoseValue.Should().Be("This schema doesn't take validation rules");
        (await StoredRulesAsync(template, "Language")).Should().BeEmpty();
    }

    [Fact]
    public async Task BulkFieldDefault_SetsAndClearsAcrossSchemas_AndNamesEachRefusal()
    {
        var template = await InsertAsync("EmailTemplate", "Name", "Read.Roles", "Update.Roles");
        var role = await InsertAsync("Role", "Name", "Read.Roles", "Update.Roles");
        var controller = Controller();
        BulkPlatformFieldDefaultRequest Bulk(FieldDefaultValue? value) =>
            new() { SchemaIds = [template, role], FieldNames = ["Read.Roles", "Update.Roles"], DefaultValue = value };

        var admins = new FieldDefaultValue { Kind = DefaultValueKind.Static, Value = new List<object> { "admin" } };
        (await controller.BulkFieldDefault(Bulk(admins), CancellationToken.None)).Should().BeOfType<OkObjectResult>();
        foreach (var (schema, field) in new[] { (template, "Read.Roles"), (template, "Update.Roles"), (role, "Read.Roles"), (role, "Update.Roles") })
            (await StoredFieldAsync(schema, field)).DefaultValue!.Kind.Should().Be(DefaultValueKind.Static);

        // A template naming one schema can't fit the other: each pair is named, and nothing changes.
        var named = await controller.BulkFieldDefault(Bulk(new FieldDefaultValue { Kind = DefaultValueKind.Template, Value = new List<object> { "{{Role.Name}}" } }), CancellationToken.None);
        named.Should().BeOfType<BadRequestObjectResult>().Subject.Value.Should().BeOfType<BaseResponse>().Subject.Errors!.Keys
            .Should().BeEquivalentTo("EmailTemplate.Read.Roles", "EmailTemplate.Update.Roles");
        (await StoredFieldAsync(role, "Read.Roles")).DefaultValue!.Kind.Should().Be(DefaultValueKind.Static);

        await controller.BulkFieldDefault(Bulk(null), CancellationToken.None);
        (await StoredFieldAsync(template, "Update.Roles")).DefaultValue.Should().BeNull();
        (await StoredFieldAsync(role, "Read.Roles")).DefaultValue.Should().BeNull();
    }

    private async Task<FieldDefinition> StoredFieldAsync(string schemaId, string field) =>
        (await Schemas.Find(s => s.ItemId == schemaId).SingleAsync()).Fields.Single(f => f.Name == field);

    private static async Task<JsonElement> SchemaRowAsync(PlatformDataAccessController controller, string id)
    {
        var body = JsonSerializer.SerializeToElement((await controller.Schemas(CancellationToken.None)).Should().BeOfType<OkObjectResult>().Subject.Value);
        return body.GetProperty("data").EnumerateArray().Single(s => s.GetProperty("id").GetString() == id);
    }

    [Fact]
    public async Task WithoutWarned_OnlyNormalSchemasAndTheirAllowedPropertiesAreOffered()
    {
        var template = await InsertEmailTemplateAsync();
        var role = await InsertAsync("Role", "Name", "Description");
        var safe = Controller(includeWarned: false);
        var notEmpty = new ValidationRule { Type = ValidationType.NotEmpty };

        // EmailTemplate is a Normal schema: TemplateSubject (Allowed) is offered, Name (validation Warned) is not.
        var flags = (await SchemaRowAsync(safe, template)).GetProperty("rules").GetProperty("fields").EnumerateArray()
            .Select(f => f.GetProperty("Path").GetString()).ToList();
        flags.Should().Contain("TemplateSubject").And.NotContain("Name");
        (await safe.SaveValidation(Rules(template, "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 80 }), CancellationToken.None))
            .Should().BeOfType<OkObjectResult>();
        Message(await safe.SaveValidation(Rules(template, "Name", notEmpty), CancellationToken.None))
            .Should().Be("Validation rules can't be set on EmailTemplate.Name");

        // Role is a Warned schema: no flags, and its endpoints answer 404.
        (await SchemaRowAsync(safe, role)).GetProperty("rules").ValueKind.Should().Be(JsonValueKind.Null);
        (await safe.SaveValidation(Rules(role, "Name", notEmpty), CancellationToken.None)).Should().BeOfType<NotFoundResult>();

        // Switched on, both are offered again.
        (await Controller(includeWarned: true).SaveValidation(Rules(template, "Name", notEmpty), CancellationToken.None))
            .Should().BeOfType<OkObjectResult>();
        (await SchemaRowAsync(Controller(includeWarned: true), role)).GetProperty("rules").GetProperty("level").GetString().Should().Be("Warned");
    }

    [Fact]
    public async Task MonitorSchemas_AreListedUnderMonitor_AndOnlyTheConfigurationTakesRules()
    {
        var configuration = await InsertAsync("MonitorConfiguration", "Name", "ExpectedContent", "CustomHttpHeaders", "TenantId");
        var incident = await InsertAsync("MonitorIncident", "MonitorId", "FailureReason");
        var pingLog = await InsertAsync("MonitorPingLog", "MonitorId", "Url");
        var safe = Controller(includeWarned: false);

        var row = await SchemaRowAsync(safe, configuration);
        row.GetProperty("service").GetString().Should().Be("Monitor");
        var fields = row.GetProperty("rules").GetProperty("fields").EnumerateArray().ToList();
        fields.Select(f => f.GetProperty("Path").GetString()).Should().Contain(["Name", "ExpectedContent"])
            .And.NotContain("CustomHttpHeaders")   // warned: only offered with RulesIncludeWarned
            .And.NotContain("TenantId");           // blocked
        fields.Single(f => f.GetProperty("Path").GetString() == "Name").GetProperty("DefaultHasNoEffect").GetBoolean().Should().BeTrue();
        (await safe.FieldDefault(new SetPlatformFieldDefaultRequest
        {
            SchemaId = configuration, FieldName = "ExpectedContent",
            DefaultValue = new FieldDefaultValue { Kind = DefaultValueKind.Static, Value = "OK" },
        }, CancellationToken.None)).Should().BeOfType<OkObjectResult>();

        foreach (var accessOnly in new[] { incident, pingLog })
        {
            var schema = await SchemaRowAsync(safe, accessOnly);
            schema.GetProperty("service").GetString().Should().Be("Monitor");
            schema.GetProperty("rules").ValueKind.Should().Be(JsonValueKind.Null);
        }
        (await Controller().SaveValidation(Rules(incident, "FailureReason", new ValidationRule { Type = ValidationType.NotEmpty }), CancellationToken.None))
            .Should().BeOfType<NotFoundResult>();
    }
}
