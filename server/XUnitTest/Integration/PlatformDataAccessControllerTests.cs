using System.Text.Json;
using Blocks.Genesis.Entities.Data;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Xunit;

namespace XUnitTest.Integration;

/// <summary>
/// The Data Access schema explorer: a platform schema's View/Create/Edit/Delete levels and field
/// tree come from one list call, and each of the four operations can be configured.
/// </summary>
[Collection(MongoIntegrationCollection.Name)]
public class PlatformDataAccessControllerTests
{
    private readonly MongoIntegrationFixture _fixture;

    public PlatformDataAccessControllerTests(MongoIntegrationFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Schemas_ReturnsAllFourAccessLevelsAndTheFieldTree()
    {
        var id = Guid.NewGuid().ToString();
        await _fixture.Collection<SchemaDefinition>("SchemaDefinitions").InsertOneAsync(new SchemaDefinition
        {
            ItemId = id,
            SchemaName = "Role",
            CollectionName = "Roles",
            IsSystemEntity = true,
            ReadAccessLevel = SchemaAccessLevel.Public,
            WriteAccessLevel = SchemaAccessLevel.User,
            EditAccessLevel = SchemaAccessLevel.Custom,
            DeleteAccessLevel = SchemaAccessLevel.Inherited,
            Fields =
            [
                new FieldDefinition { Name = "Name", Type = "String", IsPIIData = true, Description = "Role name" },
                new FieldDefinition { Name = "Create", Type = "OperationAccess" },
                new FieldDefinition { Name = "Create.Roles", Type = "String", IsArray = true, IsReferenceField = true },
            ],
        });
        var controller = new PlatformDataAccessController(_fixture.DbContextProvider);

        var result = await controller.Schemas(CancellationToken.None);

        var body = JsonSerializer.SerializeToElement(result.Should().BeOfType<OkObjectResult>().Subject.Value);
        var schema = body.GetProperty("data").EnumerateArray().Single(s => s.GetProperty("id").GetString() == id);
        schema.GetProperty("service").GetString().Should().Be("IAM");
        schema.GetProperty("readAccessLevel").GetInt32().Should().Be((int)SchemaAccessLevel.Public);
        schema.GetProperty("writeAccessLevel").GetInt32().Should().Be((int)SchemaAccessLevel.User);
        schema.GetProperty("editAccessLevel").GetInt32().Should().Be((int)SchemaAccessLevel.Custom);
        schema.GetProperty("deleteAccessLevel").GetInt32().Should().Be((int)SchemaAccessLevel.Inherited);

        var fields = schema.GetProperty("fields").EnumerateArray().ToList();
        fields.Select(f => f.GetProperty("Name").GetString()).Should().Equal("Name", "Create");
        fields[0].GetProperty("IsPIIData").GetBoolean().Should().BeTrue();
        fields[0].GetProperty("Description").GetString().Should().Be("Role name");
        // Dotted rows come back nested under their parent, which is what the explorer expands.
        var nested = fields[1].GetProperty("Fields").EnumerateArray().Single();
        nested.GetProperty("Name").GetString().Should().Be("Roles");
        nested.GetProperty("IsArray").GetBoolean().Should().BeTrue();
    }

    [Theory]
    [InlineData(PolicyOperation.READ)]
    [InlineData(PolicyOperation.WRITE)]
    [InlineData(PolicyOperation.EDIT)]
    [InlineData(PolicyOperation.DELETE)]
    public async Task Configure_SetsTheSchemaLevelOfThatOperationOnly(PolicyOperation operation)
    {
        var id = await InsertRoleAsync();
        var controller = new PlatformDataAccessController(_fixture.DbContextProvider);

        var result = await controller.Configure(new ConfigurePlatformAccessRequest
        {
            SchemaId = id, Operation = operation, PolicyType = PolicyType.RLS, AccessLevel = SchemaAccessLevel.Custom,
        }, CancellationToken.None);

        result.Should().BeOfType<OkObjectResult>();
        var schema = await LoadAsync(id);
        var levels = new[] { schema.ReadAccessLevel, schema.WriteAccessLevel, schema.EditAccessLevel, schema.DeleteAccessLevel };
        levels.Should().Equal(Enumerable.Range(0, 4).Select(i => i == (int)operation ? SchemaAccessLevel.Custom : SchemaAccessLevel.User));
    }

    [Fact]
    public async Task Configure_FieldLevel_AllowsViewAndEditOnly()
    {
        var id = await InsertRoleAsync();
        var controller = new PlatformDataAccessController(_fixture.DbContextProvider);
        ConfigurePlatformAccessRequest Field(PolicyOperation operation) => new()
        {
            SchemaId = id, Operation = operation, PolicyType = PolicyType.CLS, FieldNames = ["Name"], AccessLevel = SchemaAccessLevel.Custom,
        };

        (await controller.Configure(Field(PolicyOperation.READ), CancellationToken.None)).Should().BeOfType<OkObjectResult>();
        // Services never apply field rules for Create or Delete, so they are refused rather than stored.
        (await controller.Configure(Field(PolicyOperation.WRITE), CancellationToken.None)).Should().BeOfType<BadRequestResult>();
        (await controller.Configure(Field(PolicyOperation.DELETE), CancellationToken.None)).Should().BeOfType<BadRequestResult>();

        var name = (await LoadAsync(id)).Fields.Single(f => f.Name == "Name");
        name.ReadAccessLevel.Should().Be(SchemaAccessLevel.Custom);
        name.WriteAccessLevel.Should().Be(SchemaAccessLevel.Inherited);
    }

    [Fact]
    public async Task Policies_AreSavedListedAndDeletedPerOperation()
    {
        var id = await InsertRoleAsync();
        var controller = new PlatformDataAccessController(_fixture.DbContextProvider);
        SavePlatformPolicyRequest Rule(PolicyOperation? operation) => new() { SchemaId = id, PolicyName = $"{operation} rule", Operation = operation, PolicyType = PolicyType.RLS };

        (await controller.Create(Rule(null), CancellationToken.None)).Should().BeOfType<BadRequestResult>();
        (await controller.Create(Rule(PolicyOperation.ALL), CancellationToken.None)).Should().BeOfType<BadRequestResult>();
        await controller.Create(Rule(PolicyOperation.DELETE), CancellationToken.None);
        await controller.Create(Rule(PolicyOperation.READ), CancellationToken.None);

        // A rule set makes that operation Custom and leaves the others alone.
        var schema = await LoadAsync(id);
        schema.DeleteAccessLevel.Should().Be(SchemaAccessLevel.Custom);
        schema.ReadAccessLevel.Should().Be(SchemaAccessLevel.Custom);
        schema.EditAccessLevel.Should().Be(SchemaAccessLevel.User);

        var listed = await ListPoliciesAsync(controller, id);
        listed.Select(p => (p.GetProperty("PolicyName").GetString(), (PolicyOperation)p.GetProperty("Operation").GetInt32()))
            .Should().BeEquivalentTo([("DELETE rule", PolicyOperation.DELETE), ("READ rule", PolicyOperation.READ)]);

        var deleteRule = listed.Single(p => p.GetProperty("Operation").GetInt32() == (int)PolicyOperation.DELETE);
        (await controller.Delete(deleteRule.GetProperty("ItemId").GetString()!, CancellationToken.None)).Should().BeOfType<OkObjectResult>();
        (await ListPoliciesAsync(controller, id)).Should().ContainSingle();
    }

    [Fact]
    public async Task Schemas_LeavesOutHiddenSchemasAndHiddenProperties()
    {
        var repoId = await InsertRepoAsync();
        var hiddenId = Guid.NewGuid().ToString();
        await _fixture.Collection<SchemaDefinition>("SchemaDefinitions").InsertOneAsync(new SchemaDefinition
        {
            ItemId = hiddenId, SchemaName = "RefreshTokenModel", CollectionName = "IdpRefreshTokens", IsSystemEntity = true,
            Fields = [new FieldDefinition { Name = "Name", Type = "String" }],
        });
        var controller = new PlatformDataAccessController(_fixture.DbContextProvider);

        var body = JsonSerializer.SerializeToElement(((OkObjectResult)await controller.Schemas(CancellationToken.None)).Value);

        var schemas = body.GetProperty("data").EnumerateArray().ToList();
        schemas.Should().NotContain(s => s.GetProperty("id").GetString() == hiddenId);
        var repo = schemas.Single(s => s.GetProperty("id").GetString() == repoId);
        repo.GetProperty("fields").EnumerateArray().Select(f => f.GetProperty("Name").GetString()).Should().Equal("Name");
        // The stored doc keeps every property: services read exactly the listed fields.
        (await LoadAsync(repoId)).Fields.Should().HaveCount(3);
    }

    [Fact]
    public async Task HiddenProperties_TakeNoRules()
    {
        var id = await InsertRepoAsync();
        var controller = new PlatformDataAccessController(_fixture.DbContextProvider);
        var hiddenCondition = new PolicyRuleGroup
        {
            NestedGroups = [new PolicyRuleGroup { Rules = [new PolicyRule { LeftOperand = "DeploySettings.Region", StaticValue = "eu" }] }],
        };

        (await controller.Configure(new ConfigurePlatformAccessRequest
        {
            SchemaId = id, Operation = PolicyOperation.READ, PolicyType = PolicyType.CLS, FieldNames = ["DeploySettings"], AccessLevel = SchemaAccessLevel.Custom,
        }, CancellationToken.None)).Should().BeOfType<BadRequestResult>();
        (await controller.Create(new SavePlatformPolicyRequest
        {
            SchemaId = id, PolicyName = "hidden", Operation = PolicyOperation.READ, PolicyType = PolicyType.CLS, FieldNames = ["DeploySettings.Region"],
        }, CancellationToken.None)).Should().BeOfType<BadRequestResult>();
        (await controller.Create(new SavePlatformPolicyRequest
        {
            SchemaId = id, PolicyName = "hidden", Operation = PolicyOperation.READ, PolicyType = PolicyType.RLS, RuleGroup = hiddenCondition,
        }, CancellationToken.None)).Should().BeOfType<BadRequestResult>();

        (await LoadAsync(id)).ReadAccessLevel.Should().Be(SchemaAccessLevel.User);
    }

    private async Task<string> InsertRepoAsync()
    {
        var id = Guid.NewGuid().ToString();
        await _fixture.Collection<SchemaDefinition>("SchemaDefinitions").InsertOneAsync(new SchemaDefinition
        {
            ItemId = id, SchemaName = "Repo", CollectionName = "Repos", IsSystemEntity = true,
            ReadAccessLevel = SchemaAccessLevel.User, WriteAccessLevel = SchemaAccessLevel.User,
            EditAccessLevel = SchemaAccessLevel.User, DeleteAccessLevel = SchemaAccessLevel.User,
            Fields =
            [
                new FieldDefinition { Name = "Name", Type = "String" },
                new FieldDefinition { Name = "DeploySettings", Type = "DeploySettings" },
                new FieldDefinition { Name = "DeploySettings.Region", Type = "String", IsReferenceField = true },
            ],
        });
        return id;
    }

    private async Task<string> InsertRoleAsync()
    {
        var id = Guid.NewGuid().ToString();
        await _fixture.Collection<SchemaDefinition>("SchemaDefinitions").InsertOneAsync(new SchemaDefinition
        {
            ItemId = id,
            SchemaName = "Role",
            CollectionName = "Roles",
            IsSystemEntity = true,
            ReadAccessLevel = SchemaAccessLevel.User,
            WriteAccessLevel = SchemaAccessLevel.User,
            EditAccessLevel = SchemaAccessLevel.User,
            DeleteAccessLevel = SchemaAccessLevel.User,
            Fields = [new FieldDefinition { Name = "Name", Type = "String" }],
        });
        return id;
    }

    private async Task<SchemaDefinition> LoadAsync(string id) =>
        await _fixture.Collection<SchemaDefinition>("SchemaDefinitions").Find(x => x.ItemId == id).SingleAsync();

    private static async Task<List<JsonElement>> ListPoliciesAsync(PlatformDataAccessController controller, string schemaId)
    {
        var result = await controller.Policies(schemaId, CancellationToken.None);
        var body = JsonSerializer.SerializeToElement(result.Should().BeOfType<OkObjectResult>().Subject.Value);
        return body.GetProperty("data").EnumerateArray().ToList();
    }
}
