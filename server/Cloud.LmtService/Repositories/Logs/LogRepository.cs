using Blocks.Genesis;
using Cloud.LmtService.Models.Logs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Cloud.LmtService.Repositories.Logs
{
    public class LogRepository : ILogRepository
    {
        private readonly IMongoDatabase _database;
        private readonly IMongoDatabase _archiveDatabase;
        private readonly ILogger<LogRepository> _logger;
        private const string FailedArchiveLogsCollection = "FailedArchiveLogs";

        public LogRepository(IBlocksSecret blocksSecret, IDbContextProvider dbContextProvider, ILogger<LogRepository> logger, IConfiguration configuration)
        {
            _database = dbContextProvider.GetDatabase(blocksSecret.LogConnectionString, blocksSecret.LogDatabaseName);
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        private static List<string> GetServiceNames(string? serviceName, IEnumerable<string>? serviceNames)
        {
            var names = serviceNames?
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name.Trim())
                .ToList() ?? [];

            if (!names.Any() && !string.IsNullOrWhiteSpace(serviceName))
                names.Add(serviceName.Trim());

            return names.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        private async Task<(List<LogProjection> Logs, long Count)> QueryCollectionAsync(
            string serviceName,
            FilterDefinition<BsonDocument> filter,
            int limit,
            int skip = 0)
        {
            var collection = _database.GetCollection<BsonDocument>(serviceName);
            var sort = Builders<BsonDocument>.Sort.Descending("Timestamp");
            var projection = Builders<BsonDocument>.Projection.As<LogProjection>();

            var countTask = collection.CountDocumentsAsync(filter);
            var logsTask = collection.Find(filter)
                .Sort(sort)
                .Project(projection)
                .Limit(limit)
                .Skip(skip)
                .ToListAsync();

            await Task.WhenAll(countTask, logsTask);

            return (logsTask.Result, countTask.Result);
        }

        public async Task<IQueryable<LogProjection>> GetLogs(LiveLogRequest query)
        {
            var bc = BlocksContext.GetContext();
            var filter = Builders<BsonDocument>.Filter.Eq("TenantId", bc?.TenantId)
                & Builders<BsonDocument>.Filter.Gt("Timestamp", query.LastDate);
            var serviceNames = GetServiceNames(query.Name, query.ServiceNames);
            var logTasks = serviceNames.Select(serviceName =>
                QueryCollectionAsync(serviceName, filter, int.MaxValue));

            var logs = await Task.WhenAll(logTasks);

            return logs
                .SelectMany(result => result.Logs)
                .OrderByDescending(log => log.Timestamp)
                .AsQueryable();
        }

        public async Task<(IQueryable<LogProjection>, long)> GetLogs(GetLogsRequest query)
        {
            var bc = BlocksContext.GetContext();
            var filter = Builders<BsonDocument>.Filter.Eq("TenantId", bc?.TenantId);

            if (!string.IsNullOrWhiteSpace(query.Search))
            {
                var regex = new BsonRegularExpression(query.Search, "i");
                filter &= Builders<BsonDocument>.Filter.Regex("Message", regex);
            }

            if (!string.IsNullOrWhiteSpace(query.Filter?.TraceId))
                filter &= Builders<BsonDocument>.Filter.Eq("TraceId", query.Filter.TraceId);

            if (!string.IsNullOrWhiteSpace(query.Filter?.SpanId))
                filter &= Builders<BsonDocument>.Filter.Eq("SpanId", query.Filter.SpanId);

            if (!string.IsNullOrWhiteSpace(query.Filter?.Level))
                filter &= Builders<BsonDocument>.Filter.Eq("Level", query.Filter.Level);

            if (query.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gt("Timestamp", query.Filter.StartDate);

            if (query.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lte("Timestamp", query.Filter.EndDate);

            var serviceNames = GetServiceNames(query.ServiceName, query.ServiceNames);
            var page = Math.Max(query.Page, 0);
            var pageSize = Math.Max(query.PageSize, 1);
            var collectionLimit = pageSize * (page + 1);
            var logTasks = serviceNames.Select(serviceName =>
                QueryCollectionAsync(serviceName, filter, collectionLimit));

            var results = await Task.WhenAll(logTasks);
            var logs = results
                .SelectMany(result => result.Logs)
                .OrderByDescending(log => log.Timestamp)
                .Skip(pageSize * page)
                .Take(pageSize);

            return (logs.AsQueryable(), results.Sum(result => result.Count));
        }

        public async Task<(IQueryable<LogProjection>, long)> GetLogs(LogsByDateRequest request)
        {
            var bc = BlocksContext.GetContext();
            var filter = Builders<BsonDocument>.Filter.Eq("TenantId", bc?.TenantId);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var regex = new BsonRegularExpression(request.Search, "i");
                filter &= Builders<BsonDocument>.Filter.Regex("Message", regex);
            }

            if (!string.IsNullOrWhiteSpace(request.Filter?.TraceId))
                filter &= Builders<BsonDocument>.Filter.Eq("TraceId", request.Filter.TraceId);

            if (!string.IsNullOrWhiteSpace(request.Filter?.SpanId))
                filter &= Builders<BsonDocument>.Filter.Eq("SpanId", request.Filter.SpanId);

            if (!string.IsNullOrWhiteSpace(request.Filter?.Level))
                filter &= Builders<BsonDocument>.Filter.Eq("Level", request.Filter.Level);

            if (request.Filter?.StartDate != null)
                filter &= Builders<BsonDocument>.Filter.Gte("Timestamp", request.Filter.StartDate);

            if (request.Filter?.EndDate != null)
                filter &= Builders<BsonDocument>.Filter.Lt("Timestamp", request.Filter.EndDate);

            var serviceNames = GetServiceNames(request.ServiceName, request.ServiceNames);
            var pageSize = Math.Max(request.PageSize, 1);
            var logTasks = serviceNames.Select(serviceName =>
                QueryCollectionAsync(serviceName, filter, pageSize));

            var results = await Task.WhenAll(logTasks);
            var logs = results
                .SelectMany(result => result.Logs)
                .OrderByDescending(log => log.Timestamp)
                .Take(pageSize);

            return (logs.AsQueryable(), results.Sum(result => result.Count));
        }
    }
}
