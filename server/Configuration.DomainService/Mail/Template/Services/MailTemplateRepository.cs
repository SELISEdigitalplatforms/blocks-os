using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.RegularExpressions;
using Blocks.Genesis.Entities.Os;
using Os.DataAccess;
using Configuration.DomainService.Organizations;

namespace Configuration.DomainService.Mail.Template.Services
{
    public class MailTemplateRepository : IMailTemplateRepository
    {
        private const string CollectionName = "EmailTemplates";
        private readonly IDbContextProvider _dbContextProvider;
        private readonly IOsDataAccess _dataAccess;

        public MailTemplateRepository(IDbContextProvider dbContextProvider, IOsDataAccess dataAccess)
        {
            _dbContextProvider = dbContextProvider;
            _dataAccess = dataAccess;
        }

        public async Task SaveAsync(EmailTemplate template)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, template.ItemId);

            // Upsert = update or insert: both gates apply. Denied is an error, not a silent no-op.
            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.SaveAsync");
            if (editFilter is null || !await _dataAccess.InsertAllowedAsync(OsSchemas.EmailTemplate, "MailTemplateRepository.SaveAsync"))
                throw new UnauthorizedAccessException("Access to the email template was denied by the data access policy.");

            template = await _dataAccess.PrepareUpsertAsync(OsSchemas.EmailTemplate, template, collection, editFilter, "MailTemplateRepository.SaveAsync");
            await collection.ReplaceOneAsync(editFilter, template, new ReplaceOptions { IsUpsert = true });
        }

        public async Task<EmailTemplate?> GetByIdAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, itemId);

            // No projection: the template is edited and saved back as a whole document.
            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.GetByIdAsync", useProjection: false);
            return scope.Granted ? await scope.Apply(collection).FirstOrDefaultAsync() : null;
        }

        public async Task<EmailTemplate?> GetForViewAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, itemId);

            // Masked: View column (property) rules clear what the caller may not see.
            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.GetForViewAsync");
            return scope.Granted ? WithOrganization(scope.ForView(await scope.Apply(collection).FirstOrDefaultAsync())) : null;
        }

        public async Task<EmailTemplate?> GetByNameAndLanguageAsync(string name, string language, string organizationId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.And(
                Builders<EmailTemplate>.Filter.Eq(t => t.Name, name),
                Builders<EmailTemplate>.Filter.Eq(t => t.Language, language),
                OfOrganization(organizationId));

            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.GetByNameAndLanguageAsync", useProjection: false);
            return scope.Granted ? await scope.Apply(collection).FirstOrDefaultAsync() : null;
        }

        public async Task<GetAllMailTemplatesResponse> GetsAsync(GetAllMailTemplatesRequest request)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filterBuilder = Builders<EmailTemplate>.Filter;
            // Organization-only lists: one organization's templates, never mixed with the Default ones.
            var filter = OfOrganization(OrganizationIds.Normalize(request.OrganizationId));

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

            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.GetsAsync");
            if (!scope.Granted)
            {
                return new GetAllMailTemplatesResponse { Templates = new List<EmailTemplate>(), TotalCount = 0 };
            }

            var totalCount = (int)await collection.CountDocumentsAsync(scope.Filter);
            var sortProperty = string.IsNullOrWhiteSpace(request.SortProperty) ? nameof(EmailTemplate.Name) : request.SortProperty;
            var sort = request.IsDescending
                ? Builders<EmailTemplate>.Sort.Descending(sortProperty)
                : Builders<EmailTemplate>.Sort.Ascending(sortProperty);

            var pageSize = request.PageSize <= 0 ? 10 : request.PageSize;
            var pageNumber = request.PageNumber < 0 ? 0 : request.PageNumber;
            var templates = await scope.Apply(collection)
                .Sort(sort)
                .Skip(pageSize * pageNumber)
                .Limit(pageSize)
                .ToListAsync();

            return new GetAllMailTemplatesResponse
            {
                Templates = scope.ForView(templates).ConvertAll(t => WithOrganization(t)!),
                TotalCount = totalCount
            };
        }

        /// <summary>The organization's templates; the Default organization's include those stored without one.</summary>
        private static FilterDefinition<EmailTemplate> OfOrganization(string organizationId) =>
            OrganizationIds.Normalize(organizationId) == OrganizationIds.Default
                ? Builders<EmailTemplate>.Filter.In(t => t.OrganizationId, OrganizationIds.StoredDefaultValues)
                : Builders<EmailTemplate>.Filter.Eq(t => t.OrganizationId, organizationId);

        // A template stored with an empty OrganizationId is the Default organization's, and says so.
        private static EmailTemplate? WithOrganization(EmailTemplate? template)
        {
            if (template is not null)
            {
                template.OrganizationId = OrganizationIds.Normalize(template.OrganizationId);
            }
            return template;
        }

        public async Task<long> CountByMailConfigurationIdAsync(string mailConfigurationId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.MailConfigurationId, mailConfigurationId);

            // Every document counts, one per template and language, as the template list's total does.
            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.CountByMailConfigurationIdAsync");
            return scope.Granted ? await collection.CountDocumentsAsync(scope.Filter) : 0;
        }

        public async Task DeleteAsync(string itemId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filter = Builders<EmailTemplate>.Filter.Eq(t => t.ItemId, itemId);

            var deleteFilter = await _dataAccess.DeleteFilterAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.DeleteAsync");
            if (deleteFilter is null)
            {
                return;
            }

            await collection.DeleteOneAsync(deleteFilter);
        }
    }
}




