using Cloud.LmtService.Models.ArchiveAndDelete;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Cloud.LmtService.Utilities
{
    public static class MongoDatabaseExtensions
    {
        public static async Task<List<string>> GetArchiveCollectionsAsync(this IMongoDatabase database)
        {
            var filter = new BsonDocument("name", new BsonDocument(
                "$not", new BsonRegularExpression("^system\\.", "i")));

            using var cursor = await database.ListCollectionNamesAsync(
                new ListCollectionNamesOptions { Filter = filter });

            return [.. await cursor.ToListAsync()];
        }
        public static async Task<List<string>> GetCollectionNamesWithDataAsync(
            this IMongoDatabase database,
            BsonDocument collectionFilter,
            DateTime startDate,
            DateTime endDate)
        {
            using var cursor = await database.ListCollectionNamesAsync(
                new ListCollectionNamesOptions { Filter = collectionFilter });
            var names = await cursor.ToListAsync();

            var dateFilter = Builders<BsonDocument>.Filter.And(
                Builders<BsonDocument>.Filter.Gt(Constants.Timestamp, startDate),
                Builders<BsonDocument>.Filter.Lte(Constants.Timestamp, endDate)
            );

            var results = new ConcurrentBag<string>();
            var projection = Builders<BsonDocument>.Projection.As<ItemId>();

            await Parallel.ForEachAsync(names, new ParallelOptions { MaxDegreeOfParallelism = 20 }, async (name, ct) =>
            {
                var collection = database.GetCollection<BsonDocument>(name);
                var hasData = await collection.Find(dateFilter)
                    .Limit(1)
                    .Project(projection)
                    .AnyAsync(ct);

                if (hasData) results.Add(name);
            });

            return [.. results];
        }
    }
}
