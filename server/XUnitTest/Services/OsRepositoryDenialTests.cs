using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Integration.Services;
using Configuration.DomainService.Mail.Template.Services;
using Configuration.DomainService.Shared.Services;
using DomainService.Entities;
using DomainService.Migration;
using Configuration.DomainService.Mail.Template;
using DomainService.Migration.Services;
using DomainService.Shared.Dtos;
using DomainService.Subscription.Services;
using FluentAssertions;
using MongoDB.Driver;
using Moq;
using Os.DataAccess;
using Worker.Consumers.Identifier;
using XUnitTest.TestHelpers;

namespace XUnitTest.Services;

/// <summary>
/// With every policy denying, each wrapped os repository call must behave like "not found / empty / no write"
/// and must never touch the collection (the collections here are strict mocks: any use throws).
/// </summary>
public class OsRepositoryDenialTests
{
    private sealed class DenyAll : IOsDataAccess
    {
        public Task<ReadScope<T>> ReadAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null, bool useProjection = true) =>
            Task.FromResult(new ReadScope<T>(false, filter, null));
        public Task<FilterDefinition<T>?> EditFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
            Task.FromResult<FilterDefinition<T>?>(null);
        public Task<FilterDefinition<T>?> DeleteFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
            Task.FromResult<FilterDefinition<T>?>(null);
        public Task<bool> InsertAllowedAsync(string schema, string callSite, string? tenantId = null) => Task.FromResult(false);
    }

    private static readonly IOsDataAccess Deny = new DenyAll();


    // A provider whose collections are strict mocks, so any collection call fails the test.
    private static IDbContextProvider StrictCollections()
    {
        var provider = new Mock<IDbContextProvider>();
        provider.Setup(p => p.GetCollection<EmailTemplate>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<EmailTemplate>>(MockBehavior.Strict).Object);
        provider.Setup(p => p.GetCollection<MailServerConfiguration>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<MailServerConfiguration>>(MockBehavior.Strict).Object);
        provider.Setup(p => p.GetCollection<IntegrationSetup>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<IntegrationSetup>>(MockBehavior.Strict).Object);
        provider.Setup(p => p.GetCollection<ResourceLimit>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<ResourceLimit>>(MockBehavior.Strict).Object);
        provider.Setup(p => p.GetCollection<MigrationTracker>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<MigrationTracker>>(MockBehavior.Strict).Object);
        var db = new Mock<IMongoDatabase>();
        db.Setup(d => d.GetCollection<IntegrationSetup>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<IntegrationSetup>>(MockBehavior.Strict).Object);
        db.Setup(d => d.GetCollection<ResourceLimit>(It.IsAny<string>(), null)).Returns(new Mock<IMongoCollection<ResourceLimit>>(MockBehavior.Strict).Object);
        provider.Setup(p => p.GetDatabase(It.IsAny<string>())).Returns(db.Object);
        return provider.Object;
    }

    [Fact]
    public async Task MailTemplateRepository_Denied()
    {
        var repo = new MailTemplateRepository(StrictCollections(), Deny);

        (await repo.GetByIdAsync("1")).Should().BeNull();
        (await repo.GetByNameAndLanguageAsync("n", "en")).Should().BeNull();
        var list = await repo.GetsAsync(new GetAllMailTemplatesRequest());
        list.TotalCount.Should().Be(0);
        list.Templates.Should().BeEmpty();
        await repo.DeleteAsync("1");
        await FluentActions.Invoking(() => repo.SaveAsync(new EmailTemplate { ItemId = "1" })).Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task ConfigurationRepository_MailConfiguration_Denied()
    {
        var repo = new ConfigurationRepository(StrictCollections(), Mock.Of<IKeyValueStore>(), Deny);

        (await repo.GetMailConfigurationByIdAsync("1")).Should().BeNull();
        (await repo.GetMailConfigurationByNameAsync("n")).Should().BeNull();
        (await repo.GetAllMailConfigurationsAsync()).Should().BeEmpty();
        (await repo.GetMailConfigurationsByClientSecretReferenceAsync("ref")).Should().BeEmpty();
        await repo.UpdateMailSenderNameAsync("1", "s", DateTime.UtcNow, "u");
        await repo.DeleteMailConfigurationAsync("1");
        await FluentActions.Invoking(() => repo.SaveMailConfigurationAsync(new MailServerConfiguration { ItemId = "1" })).Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task IntegrationRepository_Denied()
    {
        var repo = new IntegrationRepository(StrictCollections(), Mock.Of<IBlocksSecret>(), Deny);

        (await repo.HasActiveConnectionNamedAsync("n")).Should().BeFalse();
        (await repo.GetConnectionsAsync()).Should().BeEmpty();
        (await repo.GetConnectionAsync("1")).Should().BeNull();
        (await repo.RevokeConnectionAsync("1", "u")).Should().BeFalse();
        await repo.MarkConnectionNeverDeliveredAsync("env", "1");
        await FluentActions.Invoking(() => repo.TryInsertSetupAsync(new IntegrationSetup { ItemId = "1" })).Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task SubscriptionRepository_Denied_ReturnsEmpty()
    {
        var repo = new SubscriptionRepository(StrictCollections(), Deny);
        (await repo.GetSubscriptionsAsync()).Should().BeEmpty();
    }

    [Fact]
    public async Task MigrationRepository_Denied()
    {
        var repo = new MigrationRepository(StrictCollections(), Mock.Of<IBlocksSecret>(), Deny);

        (await repo.GetMigrationTrackerAsync("1")).Should().BeNull();
        (await repo.GetMigrationsByTenantGroupIdAsync("g")).Should().BeEmpty();
        (await repo.UpdateServiceStatusAsync("1", MigrationServiceNames.IAM, true)).Should().BeFalse();
        await FluentActions.Invoking(() => repo.CreateMigrationTrackerAsync(new MigrationTracker { ItemId = "1", ProjectKey = "source", TargetedProjectKey = "target", TenantGroupId = "g" })).Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task UpdateResourceUsageConsumer_Denied_DoesNotWrite()
    {
        var consumer = new UpdateResourceUsageConsumer(StrictCollections(), Deny);
        await consumer.Consume(new UpdateResourceUsageCommand_Identifier { TenantId = "t", Resource = "r", Amount = 1 });
    }

    [Fact]
    public async Task MailPreCheck_TemplateReadDenied_ReportsNoTemplate()
    {
        TestBlocksContext.Set();
        try
        {
            var provider = new Mock<IDbContextProvider>();
            provider.Setup(p => p.GetCollection<MongoDB.Bson.BsonDocument>(It.IsAny<string>(), null))
                .Returns(new Mock<IMongoCollection<MongoDB.Bson.BsonDocument>>(MockBehavior.Strict).Object);
            var to = new[] { "a@b.c" };

            (await DomainService.Migration.MailPreCheck.FindFailureAsync(provider.Object, Deny, "p", "en", to, true))
                .Should().Be("no email template for purpose and language");
            (await Cloud.LmtService.Services.ColdRestore.MailPreCheck.FindFailureAsync(provider.Object, Deny, "p", "en", to, true))
                .Should().Be("no email template for purpose and language");
        }
        finally
        {
            TestBlocksContext.Clear();
        }
    }
}
