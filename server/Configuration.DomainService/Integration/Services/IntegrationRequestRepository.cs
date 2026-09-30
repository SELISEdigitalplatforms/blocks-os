using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using MongoDB.Driver;

namespace Configuration.DomainService.Integration.Services;

public sealed class IntegrationRequestRepository : IIntegrationRequestRepository
{
    private const string DatabaseName = "BlocksConfiguration";
    private const string CollectionName = "IntegrationRequests";
    private readonly IDbContextProvider _dbContextProvider;
    private readonly IBlocksSecret _blocksSecret;

    public IntegrationRequestRepository(IDbContextProvider dbContextProvider, IBlocksSecret blocksSecret)
    {
        _dbContextProvider = dbContextProvider;
        _blocksSecret = blocksSecret;
    }

    public async Task InsertAsync(IntegrationRequest request, CancellationToken cancellationToken = default)
    {
        var collection = Collection();
        await EnsureIndexesAsync(cancellationToken);
        await collection.InsertOneAsync(request, cancellationToken: cancellationToken);
    }

    public async Task<IntegrationRequest?> GetByIdAsync(string requestId, CancellationToken cancellationToken = default) =>
        await (await Collection().FindAsync(Builders<IntegrationRequest>.Filter.Eq(r => r.ItemId, requestId), cancellationToken: cancellationToken)).FirstOrDefaultAsync(cancellationToken);

    public async Task<IntegrationRequest?> TryClaimAsync(string requestId, string userId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var claimable = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.ItemId, requestId),
            Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "pending"),
            Builders<IntegrationRequest>.Filter.Gt(r => r.ExpiresAt, now),
            Builders<IntegrationRequest>.Filter.Or(
                Builders<IntegrationRequest>.Filter.Exists(r => r.ClaimedByUserId, false),
                Builders<IntegrationRequest>.Filter.Eq(r => r.ClaimedByUserId, null),
                Builders<IntegrationRequest>.Filter.Eq(r => r.ClaimedByUserId, userId)));
        var update = Builders<IntegrationRequest>.Update
            .Set(r => r.ClaimedByUserId, userId)
            .Set(r => r.LastUpdatedDate, now);
        return await Collection().FindOneAndUpdateAsync(claimable, update, new FindOneAndUpdateOptions<IntegrationRequest> { ReturnDocument = ReturnDocument.After }, cancellationToken);
    }

    public async Task<IntegrationRequest?> TryTransitionFromPendingAsync(string requestId, string userId, string status, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var owned = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.ItemId, requestId),
            Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "pending"),
            Builders<IntegrationRequest>.Filter.Eq(r => r.ClaimedByUserId, userId),
            Builders<IntegrationRequest>.Filter.Gt(r => r.ExpiresAt, now));
        var update = Builders<IntegrationRequest>.Update
            .Set(r => r.Status, status)
            .Set(r => r.LastUpdatedDate, now);
        return await Collection().FindOneAndUpdateAsync(owned, update, new FindOneAndUpdateOptions<IntegrationRequest> { ReturnDocument = ReturnDocument.After }, cancellationToken);
    }

    public async Task<IntegrationRequest?> TryStartApprovalAsync(string requestId, string userId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var staleApprovalCutoff = now.AddMinutes(-2);
        var filter = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.ItemId, requestId),
            Builders<IntegrationRequest>.Filter.Or(
                Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "pending"),
                Builders<IntegrationRequest>.Filter.And(
                    Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "approving"),
                    Builders<IntegrationRequest>.Filter.Lt(r => r.LastUpdatedDate, staleApprovalCutoff))),
            Builders<IntegrationRequest>.Filter.Eq(r => r.ClaimedByUserId, userId),
            Builders<IntegrationRequest>.Filter.Gt(r => r.ExpiresAt, now));
        var update = Builders<IntegrationRequest>.Update
            .Set(r => r.Status, "approving")
            .Set(r => r.LastUpdatedDate, now);
        return await Collection().FindOneAndUpdateAsync(filter, update,
            new FindOneAndUpdateOptions<IntegrationRequest> { ReturnDocument = ReturnDocument.After }, cancellationToken);
    }

    public async Task ResetApprovalToPendingAsync(string requestId, CancellationToken cancellationToken = default)
    {
        var filter = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.ItemId, requestId),
            Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "approving"));
        await Collection().UpdateOneAsync(filter, Builders<IntegrationRequest>.Update
            .Set(r => r.Status, "pending")
            .Set(r => r.LastUpdatedDate, DateTime.UtcNow), cancellationToken: cancellationToken);
    }

    public async Task<bool> TryCompleteApprovalAsync(IntegrationRequest request, CancellationToken cancellationToken = default)
    {
        var result = await Collection().ReplaceOneAsync(r => r.ItemId == request.ItemId && r.Status == "approving", request,
            cancellationToken: cancellationToken);
        return result.ModifiedCount == 1;
    }

    public async Task<IntegrationRequest?> RotateApprovedCodeAsync(string requestId, string userId, string templateKey, string codeHash, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var filter = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.ItemId, requestId),
            Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "approved"),
            Builders<IntegrationRequest>.Filter.Eq(r => r.ClaimedByUserId, userId),
            Builders<IntegrationRequest>.Filter.Eq(r => r.TemplateKey, templateKey),
            Builders<IntegrationRequest>.Filter.Gt(r => r.ExpiresAt, now));
        var update = Builders<IntegrationRequest>.Update
            .Set(r => r.CodeHash, codeHash)
            .Set(r => r.LastUpdatedDate, now)
            .Set(r => r.ExpiresAt, now.AddMinutes(5));
        return await Collection().FindOneAndUpdateAsync(filter, update,
            new FindOneAndUpdateOptions<IntegrationRequest> { ReturnDocument = ReturnDocument.After }, cancellationToken);
    }

    public async Task ReplaceAsync(IntegrationRequest request, CancellationToken cancellationToken = default) =>
        await Collection().ReplaceOneAsync(r => r.ItemId == request.ItemId, request, cancellationToken: cancellationToken);

    public async Task<IntegrationRequest?> TryExchangeByCodeHashAsync(string codeHash, string redirectUri, string codeChallenge, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var matched = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.CodeHash, codeHash),
            Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "approved"),
            Builders<IntegrationRequest>.Filter.Gt(r => r.ExpiresAt, now),
            Builders<IntegrationRequest>.Filter.Eq(r => r.RedirectUri, redirectUri),
            Builders<IntegrationRequest>.Filter.Eq(r => r.CodeChallenge, codeChallenge));
        var consumed = Builders<IntegrationRequest>.Update
            .Set(r => r.Status, "exchanged")
            .Set(r => r.ExchangedDate, now)
            .Set(r => r.LastUpdatedDate, now)
            .Unset(r => r.SecretCipher);
        // Return the pre-update document so Exchange can decrypt the one-time secret, while the
        // atomic update has already removed that secret from the stored record.
        return await Collection().FindOneAndUpdateAsync(matched, consumed, new FindOneAndUpdateOptions<IntegrationRequest> { ReturnDocument = ReturnDocument.Before }, cancellationToken);
    }

    public async Task<IntegrationRequest?> MarkFailedByCodeHashAsync(string codeHash, CancellationToken cancellationToken = default)
    {
        var matched = Builders<IntegrationRequest>.Filter.And(
            Builders<IntegrationRequest>.Filter.Eq(r => r.CodeHash, codeHash),
            Builders<IntegrationRequest>.Filter.Eq(r => r.Status, "approved"));
        var update = Builders<IntegrationRequest>.Update
            .Set(r => r.Status, "failed")
            .Set(r => r.LastUpdatedDate, DateTime.UtcNow);
        return await Collection().FindOneAndUpdateAsync(matched, update,
            new FindOneAndUpdateOptions<IntegrationRequest> { ReturnDocument = ReturnDocument.Before }, cancellationToken);
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        var indexes = Collection().Indexes;
        await indexes.CreateOneAsync(new CreateIndexModel<IntegrationRequest>(Builders<IntegrationRequest>.IndexKeys.Ascending(r => r.ExpiresAt), new CreateIndexOptions { Name = "ExpiresAt_ttl", ExpireAfter = TimeSpan.Zero }), cancellationToken: cancellationToken);
        await indexes.CreateOneAsync(new CreateIndexModel<IntegrationRequest>(Builders<IntegrationRequest>.IndexKeys.Ascending(r => r.CodeHash), new CreateIndexOptions { Name = "CodeHash_unique_sparse", Unique = true, Sparse = true }), cancellationToken: cancellationToken);
        await indexes.CreateOneAsync(new CreateIndexModel<IntegrationRequest>(Builders<IntegrationRequest>.IndexKeys.Ascending(r => r.Status).Ascending(r => r.ExpiresAt), new CreateIndexOptions { Name = "Status_ExpiresAt" }), cancellationToken: cancellationToken);
    }

    private IMongoCollection<IntegrationRequest> Collection() => _dbContextProvider.GetDatabase(_blocksSecret.DatabaseConnectionString, DatabaseName).GetCollection<IntegrationRequest>(CollectionName);
}
