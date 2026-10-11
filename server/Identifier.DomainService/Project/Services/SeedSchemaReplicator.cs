using MongoDB.Bson;
using MongoDB.Driver;

namespace DomainService.Projects
{
    /// <summary>
    /// Makes a project database carry every collection and index of the seed database
    /// (<c>BlocksConfiguration</c>). The seed is the single source of truth for the tenant
    /// schema: add a collection or an index there and every new project gets it.
    /// </summary>
    /// <remarks>
    /// Additive only. It never drops, renames or rebuilds anything in the target: an index with
    /// the same name, or the same keys and collation under another name, counts as present.
    /// A failure on one index is reported and the rest still run, so one bad index (for
    /// example a unique index the copied seed data already violates) can never block a project.
    /// </remarks>
    public static class SeedSchemaReplicator
    {
        /// <summary>Collections that live only in the seed database and are read from there.</summary>
        public static readonly IReadOnlySet<string> SeedOnlyCollections =
            new HashSet<string>(StringComparer.Ordinal) { "IntegrationTemplates" };

        // listIndexes fields that describe the stored index, not the index to build.
        private static readonly string[] _nonSpecFields = ["v", "ns", "background"];

        public static async Task<SeedSchemaResult> ApplyAsync(IMongoDatabase seedDb, IMongoDatabase targetDb, CancellationToken cancellationToken = default)
        {
            var result = new SeedSchemaResult();

            // Plain collections only: views and time-series collections are not seed schema.
            var seedCollections = await (await seedDb.ListCollectionsAsync(
                new ListCollectionsOptions { Filter = new BsonDocument("type", "collection") }, cancellationToken))
                .ToListAsync(cancellationToken);
            var targetNames = (await (await targetDb.ListCollectionNamesAsync(cancellationToken: cancellationToken))
                .ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);

            foreach (var name in seedCollections.Select(c => c["name"].AsString).OrderBy(n => n, StringComparer.Ordinal))
            {
                if (name.StartsWith("system.", StringComparison.Ordinal) || SeedOnlyCollections.Contains(name)) continue;

                if (!targetNames.Contains(name))
                {
                    await CreateCollectionIfMissingAsync(targetDb, name, result, cancellationToken);
                }

                await CopyMissingIndexesAsync(seedDb, targetDb, name, result, cancellationToken);
            }

            return result;
        }

        private static async Task CreateCollectionIfMissingAsync(IMongoDatabase targetDb, string name, SeedSchemaResult result, CancellationToken cancellationToken)
        {
            try
            {
                await targetDb.CreateCollectionAsync(name, cancellationToken: cancellationToken);
                result.CollectionsCreated.Add(name);
            }
            catch (MongoCommandException ex) when (ex.CodeName == "NamespaceExists")
            {
                // Created meanwhile by a service write or a parallel run: that is the goal.
            }
        }

        private static async Task CopyMissingIndexesAsync(IMongoDatabase seedDb, IMongoDatabase targetDb, string name, SeedSchemaResult result, CancellationToken cancellationToken)
        {
            var seedIndexes = await ListIndexesAsync(seedDb, name, cancellationToken);
            var targetIndexes = await ListIndexesAsync(targetDb, name, cancellationToken);

            foreach (var seedIndex in seedIndexes)
            {
                var indexName = seedIndex["name"].AsString;
                if (indexName == "_id_") continue;

                if (targetIndexes.Any(t => t["name"].AsString == indexName || SameKeyAndCollation(t, seedIndex)))
                {
                    continue;
                }

                var spec = new BsonDocument(seedIndex.Where(e => !_nonSpecFields.Contains(e.Name)));
                try
                {
                    await targetDb.RunCommandAsync<BsonDocument>(new BsonDocument
                    {
                        { "createIndexes", name },
                        { "indexes", new BsonArray { spec } }
                    }, cancellationToken: cancellationToken);
                    result.IndexesCreated.Add($"{name}.{indexName}");
                    targetIndexes.Add(seedIndex);
                }
                catch (MongoException ex)
                {
                    result.Errors.Add($"{name}.{indexName}: {ex.Message}");
                }
            }
        }

        private static async Task<List<BsonDocument>> ListIndexesAsync(IMongoDatabase db, string name, CancellationToken cancellationToken)
        {
            try
            {
                return await (await db.GetCollection<BsonDocument>(name).Indexes.ListAsync(cancellationToken)).ToListAsync(cancellationToken);
            }
            catch (MongoCommandException ex) when (ex.CodeName == "NamespaceNotFound")
            {
                return [];
            }
        }

        // Mongo identifies an index by its key pattern (order matters) plus collation.
        private static bool SameKeyAndCollation(BsonDocument a, BsonDocument b) =>
            a["key"].Equals(b["key"]) && CollationOf(a).Equals(CollationOf(b));

        private static BsonValue CollationOf(BsonDocument index) =>
            index.TryGetValue("collation", out var c) && c is BsonDocument doc
                ? new BsonDocument { { "locale", doc.GetValue("locale", BsonNull.Value) }, { "strength", doc.GetValue("strength", BsonNull.Value) } }
                : BsonNull.Value;
    }

    public sealed class SeedSchemaResult
    {
        public List<string> CollectionsCreated { get; } = [];
        public List<string> IndexesCreated { get; } = [];
        public List<string> Errors { get; } = [];
    }
}
