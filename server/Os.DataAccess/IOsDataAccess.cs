using MongoDB.Driver;

namespace Os.DataAccess;

/// <summary>Schema names of the Genesis system entities that os owns (= entity class names).</summary>
public static class OsSchemas
{
    public const string EmailTemplate = "EmailTemplate";
    public const string IntegrationSetup = "IntegrationSetup";
    public const string ThirdPartyJWTClaims = "ThirdPartyJWTClaims";
    public const string MailServerConfiguration = "MailServerConfiguration";
    public const string ResourceLimit = "ResourceLimit";
    public const string MigrationTracker = "MigrationTracker";
}

/// <summary>
/// A resolved read. <see cref="Granted"/> false means "treat as not found / empty".
/// <see cref="Apply"/> builds the Find with the resolver's filter and projection.
/// </summary>
public sealed record ReadScope<T>(bool Granted, FilterDefinition<T> Filter, ProjectionDefinition<T>? Projection)
{
    public IFindFluent<T, T> Apply(IMongoCollection<T> collection)
    {
        var find = collection.Find(Filter);
        return Projection is null ? find : find.Project<T>(Projection);
    }
}

/// <summary>
/// The one door between os and the Genesis data access resolver (row filter + projection only).
/// Every call on the os-owned system schemas goes through it. Pass the tenant DB the call
/// targets in <c>tenantId</c> (null = the caller's own DB).
/// </summary>
public interface IOsDataAccess
{
    /// <summary>Row filter and projection for a read. Denied: <see cref="ReadScope{T}.Granted"/> is false.</summary>
    Task<ReadScope<T>> ReadAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null, bool useProjection = true);

    /// <summary>Filter for an update or replace (EDIT). Null = denied, do not write.</summary>
    Task<FilterDefinition<T>?> EditFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null);

    /// <summary>Filter for a delete (DELETE). Null = denied, do not write.</summary>
    Task<FilterDefinition<T>?> DeleteFilterAsync<T>(string schema, FilterDefinition<T> filter, string callSite, string? tenantId = null);

    /// <summary>WRITE gate for an insert. Input fields are never dropped. False = denied.</summary>
    Task<bool> InsertAllowedAsync(string schema, string callSite, string? tenantId = null);
}
