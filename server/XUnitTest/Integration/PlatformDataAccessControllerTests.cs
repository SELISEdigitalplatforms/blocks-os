using System.Text.Json;
using Blocks.Genesis.Entities.Data;
using BlocksOs.Api.Controllers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace XUnitTest.Integration;

/// <summary>
/// The Data Access schema explorer shows a platform schema's View/Create/Edit/Delete levels in its
/// header and every field's properties in its table, all from this one list call.
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
}
