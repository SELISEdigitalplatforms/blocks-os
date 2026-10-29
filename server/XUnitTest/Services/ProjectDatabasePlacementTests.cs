using Blocks.Genesis;
using DomainService.Projects;
using FluentAssertions;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services;

public partial class ProjectManagementServiceTests
{
    [Theory]
    [InlineData("prod", "mongodb://main")]
    [InlineData("dev", "mongodb://dev")]
    [InlineData("test", "mongodb://other")]
    [InlineData("stg", "mongodb://other")]
    [InlineData("iat", "mongodb://other")]
    [InlineData("uat", "mongodb://other")]
    [InlineData("prod-shadow", "mongodb://other")]
    [InlineData("pre-prod", "mongodb://other")]
    public async Task SaveProjectAsync_PersistsSelectedConnection_AndQueuesSamePlacement(string environment, string connection)
    {
        using var context = new BlocksTestContext();
        ConfigurePlacements();
        Tenant? saved = null;
        _repo.Setup(r => r.InsertProjectAsync(It.IsAny<Tenant>()))
            .Callback<Tenant>(tenant => saved = tenant).Returns(Task.CompletedTask);

        var response = await Service().SaveProjectAsync(PlacementRequest(environment));

        response.IsSuccess.Should().BeTrue();
        saved.Should().NotBeNull();
        saved!.DbConnectionString.Should().Be(connection);
        saved.Environment.Should().Be(environment);
        saved.DBName.Should().NotBeNullOrWhiteSpace().And.NotBe("BlocksRootDb");
        _repo.Verify(r => r.SaveRepoInfoAsync(saved, It.IsAny<List<Resource>>()), Times.Once);
        _messageClient.Verify(m => m.SendToConsumerAsync(It.Is<ConsumerMessage<Tenant>>(
            message => message.Payload == saved && message.Payload.DbConnectionString == connection)), Times.Once);
    }

    [Theory]
    [InlineData("dev", null)]
    [InlineData("dev", "")]
    [InlineData("dev", "   ")]
    [InlineData("stg", null)]
    [InlineData("stg", "")]
    [InlineData("stg", "   ")]
    public async Task SaveProjectAsync_BlankOptionalConnection_PersistsMain(string environment, string? optional)
    {
        using var context = new BlocksTestContext();
        ConfigurePlacements();
        _blocksSecret.SetupGet(s => s.DevDatabaseConnectionString).Returns(optional!);
        _blocksSecret.SetupGet(s => s.OtherDatabaseConnectionString).Returns(optional!);

        var response = await Service().SaveProjectAsync(PlacementRequest(environment));

        response.IsSuccess.Should().BeTrue();
        _repo.Verify(r => r.InsertProjectAsync(It.Is<Tenant>(t => t.DbConnectionString == "mongodb://main")), Times.Once);
    }

    [Theory]
    [InlineData("invalid", "mongodb://main", "mongodb://other")]
    [InlineData("DEV", "mongodb://main", "mongodb://other")]
    [InlineData("stg", "mongodb://main", "not-a-mongo-uri")]
    [InlineData("stg", "", "")]
    [InlineData("prod", "", "mongodb://other")]
    public async Task SaveProjectAsync_InvalidPlacement_RejectsEntireBatchBeforeSideEffects(
        string environment, string main, string other)
    {
        ConfigurePlacements();
        _blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns(main);
        _blocksSecret.SetupGet(s => s.OtherDatabaseConnectionString).Returns(other);
        var request = PlacementRequest("dev", environment);

        var response = await Service().SaveProjectAsync(request);

        response.IsSuccess.Should().BeFalse();
        _repo.VerifyNoOtherCalls();
        _messageClient.VerifyNoOtherCalls();
        _storage.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("existing-group")]
    public async Task SaveProjectAsync_DuplicateEnvironments_RejectsBeforeSideEffects(string? group)
    {
        ConfigurePlacements();
        var request = PlacementRequest("dev", "dev");
        request.TenantGroupId = group!;

        var response = await Service().SaveProjectAsync(request);

        response.IsSuccess.Should().BeFalse();
        _repo.VerifyNoOtherCalls();
        _messageClient.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SaveProjectAsync_AllPlacements_PreserveDistinctDatabaseNames()
    {
        using var context = new BlocksTestContext();
        ConfigurePlacements();
        var tenants = new List<Tenant>();
        _repo.Setup(r => r.InsertProjectAsync(It.IsAny<Tenant>()))
            .Callback<Tenant>(tenants.Add).Returns(Task.CompletedTask);

        var result = await Service().SaveProjectAsync(PlacementRequest("dev", "stg", "prod"));

        result.IsSuccess.Should().BeTrue();
        tenants.Should().HaveCount(3);
        tenants.Select(t => t.DBName).Should().OnlyHaveUniqueItems();
        tenants.Select(t => t.DbConnectionString).Should().BeEquivalentTo("mongodb://dev", "mongodb://other", "mongodb://main");
        tenants.Select(t => t.TenantGroupId).Distinct().Should().ContainSingle();
    }

    private void ConfigurePlacements()
    {
        _blocksSecret.SetupGet(s => s.DatabaseConnectionString).Returns("mongodb://main");
        _blocksSecret.SetupGet(s => s.DevDatabaseConnectionString).Returns("mongodb://dev");
        _blocksSecret.SetupGet(s => s.OtherDatabaseConnectionString).Returns("mongodb://other");
    }

    private static CreateProjectRequest PlacementRequest(params string[] environments) => new()
    {
        Name = "Placement test",
        applicationContexts = environments.Select(env => new ApplicationContext
        {
            Environment = env, Domain = $"https://{env}.example.com"
        }).ToList()
    };
}
