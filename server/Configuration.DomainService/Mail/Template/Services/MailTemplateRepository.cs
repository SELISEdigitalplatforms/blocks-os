using Blocks.Genesis;
using Configuration.DomainService.Mail.Entities;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.RegularExpressions;

namespace Configuration.DomainService.Mail.Template.Services
{
    public class MailTemplateRepository : IMailTemplateRepository
    {
        private const string CollectionName = "EmailTemplates";
        private const string PluginConfigCollectionName = "TemplatePluginConfigs";
        private readonly IDbContextProvider _dbContextProvider;

        public MailTemplateRepository(IDbContextProvider dbContextProvider)
        {
            _dbContextProvider = dbContextProvider;
        }

        public async Task SaveAsync(EmailTemplate template)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, template.ItemId);

            await collection.ReplaceOneAsync(filter, template, new ReplaceOptions { IsUpsert = true });
        }

        public async Task<EmailTemplate?> GetByIdAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, itemId);

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<EmailTemplate?> GetByNameAndLanguageAsync(string name, string language)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.And(
                Builders<EmailTemplate>.Filter.Eq(t => t.Name, name),
                Builders<EmailTemplate>.Filter.Eq(t => t.Language, language));

            return await collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task<GetAllMailTemplatesResponse> GetsAsync(GetAllMailTemplatesRequest request)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filterBuilder = Builders<EmailTemplate>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrWhiteSpace(request.SearchKey))
            {
                var escapedSearchKey = Regex.Escape(request.SearchKey);
                var regexFilter = filterBuilder.Or(
                    filterBuilder.Regex(t => t.Name, new BsonRegularExpression($".*{escapedSearchKey}.*", "i")),
                    filterBuilder.Regex(t => t.TemplateSubject, new BsonRegularExpression($".*{escapedSearchKey}.*", "i")));

                filter = filterBuilder.And(filter, regexFilter);
            }

            if (!string.IsNullOrWhiteSpace(request.MailConfigurationId))
            {
                filter = filterBuilder.And(
                    filter,
                    filterBuilder.Eq(t => t.MailConfigurationId, request.MailConfigurationId));
            }

            if (!string.IsNullOrWhiteSpace(request.Language))
            {
                filter = filterBuilder.And(filter, filterBuilder.Eq(t => t.Language, request.Language));
            }

            var totalCount = (int)await collection.CountDocumentsAsync(filter);
            var sortProperty = string.IsNullOrWhiteSpace(request.SortProperty) ? nameof(EmailTemplate.Name) : request.SortProperty;
            var sort = request.IsDescending
                ? Builders<EmailTemplate>.Sort.Descending(sortProperty)
                : Builders<EmailTemplate>.Sort.Ascending(sortProperty);

            var pageSize = request.PageSize <= 0 ? 10 : request.PageSize;
            var pageNumber = request.PageNumber < 0 ? 0 : request.PageNumber;
            var templates = await collection
                .Find(filter)
                .Sort(sort)
                .Skip(pageSize * pageNumber)
                .Limit(pageSize)
                .ToListAsync();

            return new GetAllMailTemplatesResponse
            {
                Templates = templates,
                TotalCount = totalCount
            };
        }

        public async Task DeleteAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, itemId);

            await collection.DeleteOneAsync(filter);
        }

        public async Task<TemplatePluginConfig?> GetPluginConfigAsync(string pluginProvider)
        {
            var collection = _dbContextProvider.GetCollection<TemplatePluginConfig>(PluginConfigCollectionName);

            var normalizedProvider = Regex.Replace(
                pluginProvider?.Trim() ?? string.Empty,
                @"\s+",
                " ",
                RegexOptions.None,
                TimeSpan.FromSeconds(2));

            var filter = Builders<TemplatePluginConfig>.Filter.Regex(
                c => c.PluginProvider,
                new BsonRegularExpression($"^{Regex.Escape(normalizedProvider)}$", "i"));

            return await collection.Find(filter).FirstOrDefaultAsync();
        }
    }
}




