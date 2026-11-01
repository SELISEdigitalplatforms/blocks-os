using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Configuration.DomainService.Shared.Services;
using FluentAssertions;
using MongoDB.Driver;
using Moq;
using Os.DataAccess;

namespace XUnitTest.Services;

/// <summary>
/// C7 (blocks-os#710): the mail reads that feed a credential operation are unprojected, so a
/// seeded projection that omits <c>AccountPasswordReference</c> can never hide the reference from
/// a save, duplicate or delete.
/// </summary>
/// <remarks>
/// The integration test against Mongo uses a pass-through data access that ignores
/// <c>useProjection</c>, so it cannot catch a switch to a projected read. This records what the
/// repository asks for instead. Every read is denied, so no collection is ever touched.
/// </remarks>
public class ConfigurationRepositoryProjectionTests
{
    private sealed class RecordingDataAccess : IOsDataAccess
    {
        public Dictionary<string, bool> UseProjectionByCallSite { get; } = new();

        public Task<ReadScope<T>> ReadAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null, bool useProjection = true)
        {
            UseProjectionByCallSite[callSite] = useProjection;
            return Task.FromResult(new ReadScope<T>(false, filter, null));
        }

        public Task<FilterDefinition<T>?> EditFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
        public Task<FilterDefinition<T>?> DeleteFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
        public Task<bool> InsertAllowedAsync(string schema, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
        public Task<T> PrepareWriteAsync<T>(string schema, T entity, bool isInsert, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
        public Task<T> PrepareUpsertAsync<T>(string schema, T entity, IMongoCollection<T> collection, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
        public Task<T> PrepareReplaceAsync<T>(string schema, T entity, IMongoCollection<T> collection, FilterDefinition<T> filter, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
        public Task CheckUpdateAsync<T>(string schema, UpdateDefinition<T> update, string callSite, string? tenantId = null) =>
            throw new System.InvalidOperationException("Not a read.");
    }

    private readonly RecordingDataAccess _dataAccess = new();

    private ConfigurationRepository Repository()
    {
        var provider = new Mock<IDbContextProvider>();
        provider.Setup(p => p.GetCollection<MailServerConfiguration>(It.IsAny<string>(), null))
                .Returns(new Mock<IMongoCollection<MailServerConfiguration>>(MockBehavior.Strict).Object);

        return new ConfigurationRepository(provider.Object, Mock.Of<IKeyValueStore>(), _dataAccess);
    }

    [Fact]
    public async Task CredentialPathReads_AreUnprojected()
    {
        var repository = Repository();

        await repository.GetMailConfigurationByIdAsync("cfg-1");
        await repository.GetMailConfigurationByNameAsync("Primary");

        _dataAccess.UseProjectionByCallSite.Should().Contain(new Dictionary<string, bool>
        {
            ["ConfigurationRepository.GetMailConfigurationByIdAsync"] = false,
            ["ConfigurationRepository.GetMailConfigurationByNameAsync"] = false
        });
    }

    [Fact]
    public async Task ViewReads_StayProjected()
    {
        var repository = Repository();

        await repository.GetMailConfigurationByNameForViewAsync("Primary");
        await repository.GetAllMailConfigurationsAsync();

        _dataAccess.UseProjectionByCallSite.Should().Contain(new Dictionary<string, bool>
        {
            ["ConfigurationRepository.GetMailConfigurationByNameForViewAsync"] = true,
            ["ConfigurationRepository.GetAllMailConfigurationsAsync"] = true
        });
    }
}
