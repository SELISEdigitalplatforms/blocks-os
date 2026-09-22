using Blocks.Genesis;
using Microsoft.Extensions.Logging;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Blocks.Secrets;

/// <summary>
/// A stored secret value. Lives in the <c>SecretStore</c> database, beside the metadata — which
/// means on the tenant's own connection, because that is where the metadata is.
/// </summary>
/// <remarks>
/// Deliberately its own collection rather than a field on <see cref="Secret"/>. Every metadata
/// read — listing, tag catalogue, audit projection — would otherwise carry the plaintext back
/// out of Mongo, and one forgotten projection would put it in an API response. Keeping it in a
/// separate document means a value is only ever read by the one query that asks for it by id.
/// </remarks>
[BsonIgnoreExtraElements]
public sealed class SecretValue : BaseEntity
{
    /// <summary>The owning secret's id. The only key this collection is ever queried by.</summary>
    public string SecretId { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;
}

/// <summary>
/// MongoDB-backed value store — the interim stand-in for Azure Key Vault.
/// </summary>
/// <remarks>
/// <para>
/// <b>This stores secret values in the database, unencrypted.</b> It exists so that secret-backed
/// configuration works in an environment that has no Key Vault provisioned yet, and it is
/// selected only when one is absent (or when <c>Secrets__ValueStore</c> asks for it explicitly).
/// Moving to <see cref="KeyVaultSecretValueStore"/> is a configuration change, not a code change.
/// </para>
/// <para>
/// The protection it does give: a value never sits in the configuration document that owns it, is
/// never returned by a configuration API, and keeps the whole <see cref="ISecretService"/>
/// contract around it — tenant-scoped authorization, rotation, soft delete and audit. What it
/// does not give is protection from anyone who can read the <c>SecretStore</c> database. That is
/// the same bar the platform already applies to Amazon SES and Zoho mail passwords and to storage
/// configuration passwords, all of which sit in plaintext in application collections today; it is
/// not a new exposure, but it is not the eventual design either.
/// </para>
/// <para>
/// Values written here are invisible to the Key Vault store and vice versa, because the two keep
/// their bytes in different places. Switching an environment that already has values in one of
/// them needs those values re-entered, not just a flag flipped.
/// </para>
/// </remarks>
public sealed class MongoSecretValueStore : ISecretValueStore
{
    private readonly SecretStoreContext _store;
    private readonly ILogger<MongoSecretValueStore> _logger;

    public MongoSecretValueStore(SecretStoreContext store, ILogger<MongoSecretValueStore> logger)
    {
        _store = store;
        _logger = logger;
    }

    private IMongoCollection<SecretValue> Collection =>
        _store.Database.GetCollection<SecretValue>(SecretCollections.SecretValues);

    public async Task SetAsync(string secretId, string value, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);
        ArgumentNullException.ThrowIfNull(value);

        try
        {
            // Upsert on SecretId, so a rotation replaces the value rather than accumulating
            // versions. The vault keeps its own history; this store deliberately does not, because
            // a superseded plaintext lying around is a liability with no reader.
            await Collection.ReplaceOneAsync(
                Builders<SecretValue>.Filter.Eq(v => v.SecretId, secretId),
                new SecretValue
                {
                    ItemId = secretId,
                    SecretId = secretId,
                    Value = value,
                    LastUpdatedDate = DateTime.UtcNow
                },
                new ReplaceOptions { IsUpsert = true },
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Wrapped in the same exception the vault store raises, so every caller's failure
            // handling — and the HTTP status the filter picks — is identical whichever store is in
            // use. The message never carries the value.
            _logger.LogError(ex, "Failed to write secret {SecretId} to the database value store.", secretId);
            throw new SecretVaultException("Failed to write the secret value to the vault.", "Set", secretId, ex);
        }
    }

    public async Task<string?> GetAsync(string secretId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);

        try
        {
            var stored = await Collection
                .Find(Builders<SecretValue>.Filter.Eq(v => v.SecretId, secretId))
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

            return stored?.Value;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to read secret {SecretId} from the database value store.", secretId);
            throw new SecretVaultException("Failed to read the secret value from the vault.", "Get", secretId, ex);
        }
    }

    /// <summary>
    /// Removes the value outright.
    /// </summary>
    /// <remarks>
    /// Only ever reached when a metadata write failed after the value was written, so there is no
    /// secret left for the value to belong to and nothing to recover it for. Key Vault does a
    /// recoverable delete at this point because that is all its API offers; a hard delete is the
    /// more honest outcome. A soft delete through <see cref="ISecretService"/> does not come here
    /// at all — it flips status and leaves the value in place so a restore can work.
    /// </remarks>
    public async Task DeleteAsync(string secretId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(secretId);

        try
        {
            await Collection
                .DeleteOneAsync(Builders<SecretValue>.Filter.Eq(v => v.SecretId, secretId), cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Failed to delete secret {SecretId} from the database value store.", secretId);
            throw new SecretVaultException("Failed to delete the secret value from the vault.", "Delete", secretId, ex);
        }
    }
}
