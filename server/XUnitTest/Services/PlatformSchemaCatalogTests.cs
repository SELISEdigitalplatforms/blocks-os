using System.Collections;
using System.Reflection;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Data;
using Configuration.DomainService.DataGateway.Services;
using FluentAssertions;
using Xunit;

namespace XUnitTest.Services;

/// <summary>What the Data Access page hides: backend-only properties and everything under them.</summary>
public class PlatformSchemaCatalogTests
{
    [Theory]
    [InlineData("Repo", "DeploySettings", true)]
    [InlineData("Repo", "DeploySettings.Region.Id", true)]
    [InlineData("Repo", "Deploy", false)] // a name prefix is not a parent
    [InlineData("Repo", "OrganizationId", false)] // common fields stay, so row rules still work
    [InlineData("MailServerConfiguration", "AccountPasswordReference", true)]
    [InlineData("MailServerConfiguration", "ClientSecretReference", true)]
    [InlineData("MailServerConfiguration", "AccountPassword", false)] // already masked by its own column rule; not backend-only
    [InlineData("IdentityProvider", "ClientSecretReference", true)]
    [InlineData("IdentityProvider", "PrivateKeyReference", true)]
    [InlineData("IdentityProvider", "JwksUri", true)]
    public void IsHiddenField_HidesThePropertyAndItsChildrenOnly(string schema, string path, bool hidden) =>
        PlatformSchemaCatalog.IsHiddenField(schema, path).Should().Be(hidden);

    [Fact]
    public void FirstHiddenInRules_FindsASchemaFieldInANestedGroup()
    {
        var group = new PolicyRuleGroup
        {
            Rules = [new PolicyRule { LeftSource = ConditionSource.AUTH, LeftOperand = "DeploySettings" }],
            NestedGroups = [new PolicyRuleGroup { Rules = [new PolicyRule { LeftOperand = "Name", RightSource = ConditionSource.SCHEMA_FIELD, RightOperand = "GithubWebhook.Url" }] }],
        };

        PlatformSchemaCatalog.FirstHiddenInRules("Repo", group).Should().Be("GithubWebhook.Url");
    }

    /// <summary>A renamed or removed property must fail here, not silently show up on the page.</summary>
    [Fact]
    public void EveryListedSchemaAndHiddenProperty_ExistsOnItsGenesisEntity()
    {
        var entities = typeof(BaseEntity).Assembly.GetTypes().Where(t => t.IsClass && !t.IsAbstract).ToLookup(t => t.Name);

        foreach (var schema in PlatformSchemaCatalog.Owners.Keys)
            entities[schema].Should().NotBeEmpty($"{schema} is offered on the page");

        foreach (var (schema, paths) in PlatformSchemaCatalog.HiddenFields)
        {
            PlatformSchemaCatalog.Owners.Should().ContainKey(schema);
            foreach (var path in paths)
                HasPath(entities[schema].First(), path).Should().BeTrue($"{schema}.{path} is in the hide list");
        }
    }

    private static bool HasPath(Type type, string path)
    {
        foreach (var name in path.Split('.'))
        {
            var property = type.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
            if (property is null) return false;
            type = ItemType(property.PropertyType);
        }
        return true;
    }

    private static Type ItemType(Type type)
    {
        if (type.IsArray) return type.GetElementType()!;
        if (type != typeof(string) && typeof(IEnumerable).IsAssignableFrom(type) && type.IsGenericType) return type.GetGenericArguments()[^1];
        return Nullable.GetUnderlyingType(type) ?? type;
    }
}
