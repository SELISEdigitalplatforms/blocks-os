using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Cloud.LmtService.Utilities;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace XUnitTest.Integration
{
    /// <summary>
    /// Covers the collection-enumeration used by the nightly backup job. A production
    /// database can contain a "garbage" collection — an orphaned time-series view whose
    /// backing system.buckets collection was dropped, for example. Such a collection is
    /// still returned by listCollections but throws the moment it is queried, and it must
    /// not take the healthy collections down with it.
    /// </summary>
    [Collection(MongoIntegrationCollection.Name)]
    public class MongoDatabaseExtensionsTests
    {
        private readonly MongoIntegrationFixture _fixture;

        public MongoDatabaseExtensionsTests(MongoIntegrationFixture fixture)
        {
            _fixture = fixture;
        }

        /// <summary>
        /// Builds a collection that listCollections reports but that fails when read, which
        /// is how an orphaned time-series collection behaves in production. A view with a
        /// pipeline that faults at execution time reproduces that contract on any server
        /// version, without needing to corrupt the catalog.
        /// </summary>
        private async Task CreateUnreadableCollectionAsync(string prefix, string name)
        {
            var source = $"{prefix}source";
            await _fixture.Collection<BsonDocument>(source)
                .InsertOneAsync(new BsonDocument { { Constants.Timestamp, DateTime.UtcNow }, { "a", 1 } });

            await _fixture.Database.CreateViewAsync(
                name,
                source,
                new EmptyPipelineDefinition<BsonDocument>().AppendStage<BsonDocument, BsonDocument, BsonDocument>(
                    new BsonDocument("$project", new BsonDocument
                    {
                        { Constants.Timestamp, 1 },
                        { "x", new BsonDocument("$divide", new BsonArray { "$a", 0 }) }
                    })));
        }

        private async Task SeedWithDataAsync(string name, DateTime timestamp)
        {
            await _fixture.Collection<BsonDocument>(name)
                .InsertOneAsync(new BsonDocument { { Constants.Timestamp, timestamp } });
        }

        [Fact]
        public async Task GetCollectionNamesWithDataAsync_SkipsUnreadableCollection_AndStillReturnsHealthyOnes()
        {
            var prefix = "gcn" + Guid.NewGuid().ToString("N")[..8];
            var now = DateTime.UtcNow;

            await SeedWithDataAsync($"{prefix}_healthy_one", now);
            await SeedWithDataAsync($"{prefix}_healthy_two", now);
            await CreateUnreadableCollectionAsync(prefix, $"{prefix}_garbage");

            var filter = new BsonDocument("name", new BsonRegularExpression($"^{prefix}_"));

            var names = await _fixture.Database.GetCollectionNamesWithDataAsync(
                filter, now.AddDays(-1), now.AddDays(1));

            names.Should().BeEquivalentTo([$"{prefix}_healthy_one", $"{prefix}_healthy_two"]);
        }

        [Fact]
        public async Task GetCollectionNamesWithDataAsync_LogsTheNameOfEachSkippedCollection()
        {
            var prefix = "gcnlog" + Guid.NewGuid().ToString("N")[..8];
            var now = DateTime.UtcNow;

            await SeedWithDataAsync($"{prefix}_healthy", now);
            await CreateUnreadableCollectionAsync(prefix, $"{prefix}_garbage");

            var filter = new BsonDocument("name", new BsonRegularExpression($"^{prefix}_"));
            var logger = new CapturingLogger();

            await _fixture.Database.GetCollectionNamesWithDataAsync(
                filter, now.AddDays(-1), now.AddDays(1), logger);

            logger.Entries.Should().ContainSingle(entry =>
                entry.Level == LogLevel.Warning && entry.Message.Contains($"{prefix}_garbage"));
        }

        private sealed record LogEntry(LogLevel Level, string Message);

        private sealed class CapturingLogger : ILogger
        {
            public ConcurrentBag<LogEntry> Entries { get; } = [];

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
                Exception? exception, Func<TState, Exception?, string> formatter)
            {
                Entries.Add(new LogEntry(logLevel, formatter(state, exception)));
            }
        }
    }
}
