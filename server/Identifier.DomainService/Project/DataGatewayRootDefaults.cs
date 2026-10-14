using MongoDB.Bson;

namespace DomainService.Projects
{
    /// <summary>
    /// Root DSC doc a new project gets when the os switch <c>DataGateway:RootConfigEnabled</c> is on (os SPEC2
    /// §6.7, X-5): root DSC collection in <c>BlocksRootDb</c>, <c>_id = TenantId</c>. Replaces the copy of the
    /// seed tenant doc. Fields = the seed doc's non-secret fields; no secret, no Redis hash (no hash = Blocks DB).
    /// <para>
    /// Field names are plain strings on purpose: Identifier.DomainService does not reference the Configuration
    /// entity (no new project reference). They must match blocks-data's <c>DataServiceConfiguration</c>.
    /// </para>
    /// <para>
    /// <b>Values must equal the seed doc</b> (DSC seed collection in <c>BlocksConfiguration</c>) of every env:
    /// migrate.sh step <c>X10</c> compares each env's <c>[seed-doc]</c> plan-log line with these constants and
    /// stops on a difference. A custom connection string in the seed = stop (needs a decision).
    /// </para>
    /// </summary>
    public static class DataGatewayRootDefaults
    {
        public const string CollectionName = "DataServiceConfigurations";

        /// <summary>The seed doc's <c>_id</c> (becomes <c>ConfigItemId</c>, the API's <c>ItemId</c>). Checked by X10.</summary>
        public const string ConfigItemId = "blocks-default-data-source";

        /// <summary>Seed connection kind: <c>"default"</c> → <c>DbConnectionSecretId "default"</c>; blank → null.</summary>
        public const string? DbConnectionSecretId = "default";

        public const string DatabaseName = "";
        public const bool IsCollectionNameEditable = false;
        public const string CollectionNamePattern = "sb_{SchemaName}s";

        /// <summary>Seed <c>AnalyticsConfiguration.EnableAnalytics</c>; null = the seed doc has no analytics block.</summary>
        public static readonly bool? AnalyticsEnabled = null;

        public const string ProjectKey = "";
        public const string ProjectShortKey = "";

        public static BsonDocument Build(string tenantId, string? createdBy, DateTime now)
        {
            var document = new BsonDocument
            {
                { "_id", tenantId },
                { "ConfigItemId", ConfigItemId },
                { "DatabaseName", DatabaseName },
                { "IsCollectionNameEditable", IsCollectionNameEditable },
                { "CollectionNamePattern", CollectionNamePattern },
                { "ProjectKey", ProjectKey },
                { "ProjectShortKey", ProjectShortKey },
                { "CreatedDate", now },
                { "LastUpdatedDate", now },
                { "CreatedBy", (BsonValue?)createdBy ?? BsonNull.Value },
                { "LastUpdatedBy", (BsonValue?)createdBy ?? BsonNull.Value },
                { "IsDeleted", false },
            };

            if (DbConnectionSecretId != null)
            {
                document.Add("DbConnectionSecretId", DbConnectionSecretId);
            }

            if (AnalyticsEnabled.HasValue)
            {
                document.Add("AnalyticsConfiguration", new BsonDocument
                {
                    { "EnableAnalytics", AnalyticsEnabled.Value },
                    { "EnableDate", BsonNull.Value },
                    { "ValidTill", BsonNull.Value },
                });
            }

            return document;
        }
    }
}
