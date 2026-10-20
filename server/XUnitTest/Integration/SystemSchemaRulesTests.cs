using Blocks.Genesis;
using Blocks.Genesis.DataAccess;
using Blocks.Genesis.DataAccess.Evaluation;
using Blocks.Genesis.DataAccess.Rules;
using Blocks.Genesis.Entities.Data;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Moq;
using Os.DataAccess;
using XUnitTest.TestSupport;

namespace XUnitTest.Integration;

/// <summary>
/// Part B for OS: validation rules and default values on the system schemas OS owns, through the real
/// Genesis resolver. With nothing configured a save is exactly what it was before.
/// </summary>
[Collection(MongoIntegrationCollection.Name)]
public sealed class SystemSchemaRulesTests : IDisposable
{
    private readonly MongoIntegrationFixture _fixture;
    private readonly BlocksTestContext _context = new();
    private readonly OsDataAccess _dataAccess;

    public SystemSchemaRulesTests(MongoIntegrationFixture fixture)
    {
        _fixture = fixture;
        var resolver = new DataAccessResolver(fixture.DbContextProvider, new DataAccessPolicyResolutionService(new SchemaPolicySource()),
            new BlocksContextAccessPrincipalAccessor(), new DataAccessOptions { SystemEntitiesOnly = true });
        _dataAccess = new OsDataAccess(resolver, NullLogger<OsDataAccess>.Instance);

        Schemas.DeleteMany(s => s.SchemaName == "EmailTemplate" || s.SchemaName == "MailServerConfiguration");
        Validations.DeleteMany(FilterDefinition<DataValidation>.Empty);
        Schemas.InsertMany(
        [
            SystemSchema("EmailTemplate", "Name", "TemplateSubject", "TemplateBody", "ImageUrl", "MailConfigurationId"),
            SystemSchema("MailServerConfiguration", "Name", "SenderName", "Host"),
        ]);
    }

    public void Dispose() => _context.Dispose();

    private IMongoCollection<SchemaDefinition> Schemas => _fixture.Collection<SchemaDefinition>("SchemaDefinitions");
    private IMongoCollection<DataValidation> Validations => _fixture.Collection<DataValidation>("DataValidations");

    private static SchemaDefinition SystemSchema(string name, params string[] fields) => new()
    {
        ItemId = $"sch-{name}-{Guid.NewGuid():N}",
        SchemaName = name,
        CollectionName = name + "s",
        SchemaType = SchemaType.Entity,
        IsSystemEntity = true,
        Fields = fields.Select(f => new FieldDefinition { Name = f, Type = "String" }).ToList(),
    };

    private void Rule(string schema, string field, ValidationRule rule)
    {
        var schemaId = Schemas.Find(s => s.SchemaName == schema).Single().ItemId;
        rule.EvaluationVersion = 1;
        Validations.InsertOne(new DataValidation { ItemId = Guid.NewGuid().ToString(), SchemaId = schemaId, FieldName = field, Validations = [rule] });
    }

    private void Default(string schema, string field, FieldDefaultValue value)
    {
        var definition = Schemas.Find(s => s.SchemaName == schema).Single();
        definition.Fields.Single(f => f.Name == field).DefaultValue = value;
        Schemas.ReplaceOne(s => s.ItemId == definition.ItemId, definition);
    }

    private MailTemplateRepository Templates() => new(_fixture.DbContextProvider, _dataAccess);

    private BsonDocument StoredTemplate(string id) =>
        _fixture.Collection<BsonDocument>("EmailTemplates").Find(new BsonDocument("_id", id)).Single();

    private static EmailTemplate Template(string id, string? subject = "Welcome aboard") =>
        new() { ItemId = id, Name = "Welcome", Language = "en", TemplateSubject = subject, TemplateBody = "Hi" };

    [Fact]
    public async Task NothingConfigured_SavesTheDocumentUnchanged()
    {
        var id = "tpl-" + Guid.NewGuid().ToString("N");
        var template = Template(id);

        await Templates().SaveAsync(template);

        StoredTemplate(id).Should().BeEquivalentTo(template.ToBsonDocument());
    }

    [Fact]
    public async Task ABrokenRule_RefusesTheSave_AndNothingIsStored()
    {
        Rule("EmailTemplate", "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 5 });
        var id = "tpl-" + Guid.NewGuid().ToString("N");

        var act = () => Templates().SaveAsync(Template(id));

        (await act.Should().ThrowAsync<DataValidationException>()).Which.Result.Errors.Should().ContainSingle()
            .Which.FieldName.Should().Be("TemplateSubject");
        _fixture.Collection<BsonDocument>("EmailTemplates").CountDocuments(new BsonDocument("_id", id)).Should().Be(0);
    }

    [Fact]
    public async Task ADefault_FillsANullProperty_OnInsertOnly()
    {
        Default("EmailTemplate", "ImageUrl", new FieldDefaultValue { Kind = DefaultValueKind.Template, Value = "https://cdn/{{EmailTemplate.Name}}.png" });
        var id = "tpl-" + Guid.NewGuid().ToString("N");

        var template = Template(id);
        await Templates().SaveAsync(template);
        StoredTemplate(id)["ImageUrl"].AsString.Should().Be("https://cdn/Welcome.png");
        template.ImageUrl.Should().Be("https://cdn/Welcome.png", "the caller's own instance carries the default");

        // Saving the existing template again (a replace) leaves a cleared value cleared: defaults are for inserts.
        await Templates().SaveAsync(Template(id));
        StoredTemplate(id)["ImageUrl"].IsBsonNull.Should().BeTrue();
    }

    [Fact]
    public async Task RulesAndDefaultsOnBlockedProperties_AreIgnored()
    {
        // MailConfigurationId has no [AllowRules]: whatever is stored for it has no effect.
        Rule("EmailTemplate", "MailConfigurationId", new ValidationRule { Type = ValidationType.NotEmpty });
        Default("EmailTemplate", "MailConfigurationId", new FieldDefaultValue { Kind = DefaultValueKind.Static, Value = "cfg" });
        var id = "tpl-" + Guid.NewGuid().ToString("N");

        await Templates().SaveAsync(Template(id));

        StoredTemplate(id)["MailConfigurationId"].IsBsonNull.Should().BeTrue();
    }

    [Fact]
    public async Task APartialUpdate_ChecksOnlyTheFieldsItSets()
    {
        Rule("MailServerConfiguration", "SenderName", new ValidationRule { Type = ValidationType.MaxLength, Value = 10 });
        Rule("MailServerConfiguration", "Name", new ValidationRule { Type = ValidationType.NotEmpty });   // not sent: not checked
        var repository = new ConfigurationRepository(_fixture.DbContextProvider, Mock.Of<IKeyValueStore>(), _dataAccess);
        var id = "cfg-" + Guid.NewGuid().ToString("N");
        await _fixture.Collection<BsonDocument>("MailServerConfigurations").InsertOneAsync(new BsonDocument { { "_id", id }, { "SenderName", "Old" } });

        await repository.UpdateMailSenderNameAsync(id, "Blocks", DateTime.UtcNow, "user-1");
        var tooLong = () => repository.UpdateMailSenderNameAsync(id, "A sender name that is far too long", DateTime.UtcNow, "user-1");

        (await tooLong.Should().ThrowAsync<DataValidationException>()).Which.Result.Errors.Single().FieldName.Should().Be("SenderName");
        _fixture.Collection<BsonDocument>("MailServerConfigurations").Find(new BsonDocument("_id", id)).Single()["SenderName"].AsString.Should().Be("Blocks");
    }

    [Fact]
    public async Task OnInsert_TheRequesterJoinsReadUpdateAndDeleteUserIds_KeepingIdsAlreadyThere()
    {
        var id = "tpl-" + Guid.NewGuid().ToString("N");
        var template = Template(id);
        template.Read = new OperationAccess { UserIds = ["user-9"], Roles = ["admin"] };
        template.Update = new OperationAccess { UserIds = ["user-1"] };

        await Templates().SaveAsync(template);

        var stored = StoredTemplate(id);
        stored["Read"]["UserIds"].AsBsonArray.Select(v => v.AsString).Should().Equal("user-9", "user-1");
        stored["Read"]["Roles"].AsBsonArray.Select(v => v.AsString).Should().Equal("admin");
        stored["Update"]["UserIds"].AsBsonArray.Select(v => v.AsString).Should().Equal("user-1");   // once
        stored["Delete"]["UserIds"].AsBsonArray.Select(v => v.AsString).Should().Equal("user-1");
        stored.Contains("Create").Should().BeFalse();
    }

    [Fact]
    public async Task OnReplace_TheAccessListsAreLeftAsSent()
    {
        var id = "tpl-" + Guid.NewGuid().ToString("N");
        await Templates().SaveAsync(Template(id));

        await Templates().SaveAsync(Template(id));

        StoredTemplate(id).Contains("Read").Should().BeFalse();
    }

    [Fact]
    public async Task WithoutASignedInUser_NoRequesterIsAdded()
    {
        BlocksContext.ClearContext();
        var id = "tpl-" + Guid.NewGuid().ToString("N");

        await Templates().SaveAsync(Template(id));

        StoredTemplate(id).Contains("Read").Should().BeFalse();
    }

    [Fact]
    public async Task WithoutASignedInUser_NoRulesRun()
    {
        Rule("EmailTemplate", "TemplateSubject", new ValidationRule { Type = ValidationType.MaxLength, Value = 5 });
        BlocksContext.ClearContext();
        var id = "tpl-" + Guid.NewGuid().ToString("N");

        await Templates().SaveAsync(Template(id));

        StoredTemplate(id)["TemplateSubject"].AsString.Should().Be("Welcome aboard");
    }
}
