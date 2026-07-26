using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using Configuration.DomainService.Mail.Enums;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Globalization;

namespace Configuration.DomainService.Mail.Mailbox.Services
{
    public class MailboxRepository : IMailboxRepository
    {
        private const string LastAccumulator = "$last";
        private readonly IDbContextProvider _dbContextProvider;

        public MailboxRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task<(List<MailBoxEntityResponse> Mails, long TotalCount)> GetMailBoxAggregatedMailsAsync(GetMailBoxMailsRequest request)
        {
            var dbContext = _dbContextProvider.GetDatabase();
            var collection = dbContext.GetCollection<MailBoxEntity>($"{nameof(MailBoxEntity)}s");

            var groupBy = new BsonDocument
            {
                { "_id", $"${nameof(MailBoxEntity.MessageId)}" },
                {
                    nameof(MailBoxEntityResponse.Timeline),
                    new BsonDocument
                    {
                        {
                            "$push",
                            new BsonDocument
                            {
                                { nameof(MailBoxEntityResponse.Status), $"${nameof(MailBoxEntity.Status)}" },
                                { nameof(MailBoxEntityResponse.Date), $"${nameof(MailBoxEntity.Date)}" }
                            }
                        }
                    }
                },
                { nameof(MailBoxEntityResponse.Status), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.Status)}" } } },
                { nameof(MailBoxEntityResponse.ItemId), new BsonDocument { { LastAccumulator, "$_id" } } },
                { nameof(MailBoxEntityResponse.Date), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.Date)}" } } },
                { nameof(MailBoxEntityResponse.From), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.From)}" } } },
                { nameof(MailBoxEntityResponse.To), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.To)}" } } },
                { nameof(MailBoxEntityResponse.Subject), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.Subject)}" } } },
                { nameof(MailBoxEntityResponse.Body), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.Body)}" } } },
                { nameof(MailBoxEntityResponse.Error), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.Error)}" } } },
                { nameof(MailBoxEntityResponse.RawMime), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.RawMime)}" } } },
                { nameof(MailBoxEntityResponse.IsInbound), new BsonDocument { { LastAccumulator, $"${nameof(MailBoxEntity.IsInbound)}" } } },
            };

            var projection = new BsonDocument
            {
                { "_id", $"${nameof(MailBoxEntityResponse.ItemId)}" },
                { nameof(MailBoxEntity.MessageId), "$_id" },
                { nameof(MailBoxEntityResponse.Timeline), 1 },
                { nameof(MailBoxEntityResponse.Status), 1 },
                { nameof(MailBoxEntityResponse.Date), 1 },
                { nameof(MailBoxEntityResponse.From), 1 },
                { nameof(MailBoxEntityResponse.To), 1 },
                { nameof(MailBoxEntityResponse.Subject), 1 },
                { nameof(MailBoxEntityResponse.Body), 1 },
                { nameof(MailBoxEntityResponse.Error), 1 },
                { nameof(MailBoxEntityResponse.RawMime), 1 },
                { nameof(MailBoxEntityResponse.IsInbound), 1 },
            };

            var typeMatch = new BsonDocument();
            if (request.IsInbound.HasValue)
            {
                typeMatch.Add(nameof(MailBoxEntity.IsInbound), request.IsInbound.Value);
            }

            var match = new BsonDocument();
            if (!string.IsNullOrEmpty(request.Status) &&
                Enum.TryParse<MailStatus>(request.Status, true, out var status))
            {
                match.Add(nameof(MailBoxEntityResponse.Status), status.ToString());
            }

            var dateFilter = new BsonDocument();
            if (!string.IsNullOrWhiteSpace(request.SendDateRange?.StartDate) &&
                DateTime.TryParse(request.SendDateRange.StartDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var startDate))
            {
                dateFilter.Add("$gt", startDate);
            }

            if (!string.IsNullOrWhiteSpace(request.SendDateRange?.EndDate) &&
                DateTime.TryParse(request.SendDateRange.EndDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var endDate))
            {
                dateFilter.Add("$lte", endDate);
            }

            if (dateFilter.ElementCount > 0)
            {
                match.Add(nameof(MailBoxEntityResponse.Date), dateFilter);
            }

            if (!string.IsNullOrEmpty(request.SearchText))
            {
                var orConditions = new BsonArray
                {
                    new BsonDocument(nameof(MailBoxEntityResponse.Subject), new BsonRegularExpression(request.SearchText, "i")),
                    new BsonDocument(nameof(MailBoxEntityResponse.From), new BsonRegularExpression(request.SearchText, "i")),
                    new BsonDocument(nameof(MailBoxEntityResponse.To), new BsonRegularExpression(request.SearchText, "i"))
                };
                match.Add("$or", orConditions);
            }

            var baseAggregate = collection.Aggregate()
                .Match(typeMatch)
                .Sort(Builders<MailBoxEntity>.Sort.Ascending(x => x.Date))
                .Group(groupBy)
                .Match(match)
                .Sort(new BsonDocument(nameof(MailBoxEntityResponse.Date), -1));

            var countResult = await baseAggregate.Count().FirstOrDefaultAsync();
            var totalCount = countResult?.Count ?? 0;
            var pageNumber = request.PageNumber < 0 ? 0 : request.PageNumber;
            var pageSize = request.PageSize <= 0 ? 10 : request.PageSize;

            var mails = await baseAggregate
                .Project<MailBoxEntityResponse>(projection)
                .Skip(pageNumber * pageSize)
                .Limit(pageSize)
                .ToListAsync();

            return (mails, totalCount);
        }

        public async Task<MailBoxEntity?> GetMailBoxMailAsync(string messageId)
        {
            var dbContext = _dbContextProvider.GetDatabase();
            var collection = dbContext.GetCollection<MailBoxEntity>($"{nameof(MailBoxEntity)}s");
            var filter = Builders<MailBoxEntity>.Filter.Eq(x => x.MessageId, messageId);
            var entities = await collection.Find(filter).ToListAsync();

            if (entities.Count == 0)
            {
                return null;
            }

            var latestEntity = entities
                .OrderByDescending(x => x.Date)
                .ThenByDescending(x => x.Status != MailStatus.Sent)
                .First();

            if (string.IsNullOrEmpty(latestEntity.Body))
            {
                var sentEntity = entities.FirstOrDefault(x => x.Status == MailStatus.Sent);
                if (sentEntity != null && !string.IsNullOrEmpty(sentEntity.Body))
                {
                    latestEntity.Body = sentEntity.Body;
                }
            }

            return latestEntity;
        }
    }
}
