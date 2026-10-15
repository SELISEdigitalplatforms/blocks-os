using MongoDB.Bson;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project's <c>IdentityConfigurations</c> document the tenant configuration (signup
    /// and organization settings) in its <c>TenantConfiguration</c> field, where blocks-iam reads it
    /// first since the collection cut.
    /// </summary>
    /// <remarks>
    /// This is a new project's only copy: it does not get a <c>TenantConfigurations</c> collection, which
    /// the seed may still have until the collection-cut cleanup. A blocks-iam from before the collection cut
    /// reads only that collection, so it finds no tenant configuration for projects created this way.
    /// </remarks>
    public static class TenantConfigurationEmbedding
    {
        /// <summary>The field of the <c>IdentityConfigurations</c> document blocks-iam reads.</summary>
        public const string FieldName = "TenantConfiguration";

        /// <summary>The collection the configuration lived in before the collection cut.</summary>
        public const string LegacyCollection = "TenantConfigurations";

        /// <summary>
        /// Puts the tenant configuration into <paramref name="identityConfiguration"/>, stamped with
        /// <paramref name="createdBy"/> the way every copied seed document is.
        /// A seed that already carries the field (a migrated seed) keeps its own; otherwise a copy of
        /// <paramref name="seedTenantConfiguration"/> is used. Returns false, changing nothing, when
        /// there is neither.
        /// </summary>
        public static bool Apply(BsonDocument identityConfiguration, BsonDocument? seedTenantConfiguration, string? createdBy)
        {
            ArgumentNullException.ThrowIfNull(identityConfiguration);

            BsonDocument tenantConfiguration;
            if (identityConfiguration.TryGetValue(FieldName, out var existing) && existing.IsBsonDocument)
            {
                tenantConfiguration = existing.AsBsonDocument;
            }
            else if (seedTenantConfiguration != null)
            {
                tenantConfiguration = seedTenantConfiguration.DeepClone().AsBsonDocument;
            }
            else
            {
                return false;
            }

            tenantConfiguration["CreatedBy"] = createdBy;
            tenantConfiguration["LastUpdatedBy"] = createdBy;
            identityConfiguration[FieldName] = tenantConfiguration;
            return true;
        }
    }
}
