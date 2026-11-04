using Blocks.Genesis;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Configuration.DomainService.Organizations
{
    /// <inheritdoc />
    /// <remarks>
    /// Reads blocks-iam's <c>Organizations</c> collection directly and never writes it. Only the id,
    /// name and disabled flag are mapped, and only id and name are projected, so the rest of the
    /// IAM document (addresses, theme, member defaults) never loads here.
    /// </remarks>
    public class OrganizationReader : IOrganizationReader
    {
        internal const string CollectionName = "Organizations";
        private const int MaxPageSize = 100;

        private readonly IDbContextProvider _dbContextProvider;

        public OrganizationReader(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<bool> ExistsEnabledAsync(string organizationId, CancellationToken cancellationToken = default)
        {
            if (OrganizationIds.Normalize(organizationId) == OrganizationIds.Default)
            {
                return true;
            }

            var filter = Builders<OrganizationDocument>.Filter.And(
                Builders<OrganizationDocument>.Filter.Eq(o => o.ItemId, organizationId),
                Enabled);

            var count = await Collection()
                .CountDocumentsAsync(filter, new CountOptions { Limit = 1 }, cancellationToken)
                .ConfigureAwait(false);
            return count > 0;
        }

        public async Task<IReadOnlyList<OrganizationSummary>> GetEnabledPageAsync(string? after, int size, CancellationToken cancellationToken = default)
        {
            ArgumentOutOfRangeException.ThrowIfNegativeOrZero(size);

            var filter = Enabled;
            if (!string.IsNullOrEmpty(after))
            {
                filter &= Builders<OrganizationDocument>.Filter.Gt(o => o.ItemId, after);
            }

            var page = await Collection()
                .Find(filter)
                .Project<OrganizationDocument>(Builders<OrganizationDocument>.Projection.Include(o => o.ItemId).Include(o => o.Name))
                .SortBy(o => o.ItemId)
                .Limit(Math.Min(size, MaxPageSize))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            return page.Select(o => new OrganizationSummary(o.ItemId, o.Name ?? string.Empty)).ToList();
        }

        // IsDisabled != true: an organization written without the flag counts as enabled.
        private static FilterDefinition<OrganizationDocument> Enabled =>
            Builders<OrganizationDocument>.Filter.Ne(o => o.IsDisabled, true);

        private IMongoCollection<OrganizationDocument> Collection() =>
            _dbContextProvider.GetCollection<OrganizationDocument>(CollectionName);

        /// <summary>The three fields of blocks-iam's organization document this reader uses.</summary>
        [BsonIgnoreExtraElements]
        internal sealed class OrganizationDocument
        {
            [BsonId]
            public string ItemId { get; set; } = string.Empty;

            public string? Name { get; set; }

            public bool IsDisabled { get; set; }
        }
    }
}
