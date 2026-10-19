using System.Text.Json;
using Blocks.Genesis;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Data;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
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

    private PlatformDataAccessController Controller(bool rulesEnabled = true, bool includeWarned = true) => new(_fixture.DbContextProvider,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            [PlatformDataAccessController.RulesEnabledSetting] = rulesEnabled.ToString(),
            [PlatformDataAccessController.RulesIncludeWarnedSetting] = includeWarned.ToString(),
        }).Build());

    private IMongoCollection<SchemaDefinition> Schemas => _fixture.Collection<SchemaDefinition>("SchemaDefinitions");
    private IMongoCollection<DataValidation> Validations => _fixture.Collection<DataValidation>("DataValidations");

    private async Task<string> InsertAsync(string schemaName, params string[] fields)
    {
        var id = Guid.NewGuid().ToString();
        await Schemas.InsertOneAsync(new SchemaDefinition
        {
            ItemId = id, SchemaName = schemaName, CollectionName = schemaName + "s", SchemaType = SchemaType.Entity, IsSystemEntity = true,
            Fields = fields.Select(f => new FieldDefinition { Name = f, Type = "String", IsArray = f == "Tags" }).ToList(),
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
