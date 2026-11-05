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
            var filter = filterBuilder.And(
                OfOrganization(OrganizationIds.Normalize(request.OrganizationId)),
                Matching(request.SearchKey, request.Language));

            if (!string.IsNullOrWhiteSpace(request.MailConfigurationId))
            {
                filter = filterBuilder.And(
                    filter,
                    filterBuilder.Eq(t => t.MailConfigurationId, request.MailConfigurationId));
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

        /// <summary>
        /// The list's search and language rules, shared by GetTemplates and AssignTemplates so "all matching"
        /// means what the list shows: the search key is a literal, case-insensitive part of the name or subject.
        /// </summary>
        private static FilterDefinition<EmailTemplate> Matching(string? searchKey, string? language)
        {
            var filterBuilder = Builders<EmailTemplate>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrWhiteSpace(searchKey))
            {
                var escapedSearchKey = Regex.Escape(searchKey);
                filter &= filterBuilder.Or(
                    filterBuilder.Regex(t => t.Name, new BsonRegularExpression($".*{escapedSearchKey}.*", "i")),
                    filterBuilder.Regex(t => t.TemplateSubject, new BsonRegularExpression($".*{escapedSearchKey}.*", "i")));
            }

            if (!string.IsNullOrWhiteSpace(language))
            {
                filter &= filterBuilder.Eq(t => t.Language, language);
            }

            return filter;
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

        public async Task<long> CountOutsideOrganizationAsync(IReadOnlyCollection<string> templateIds, string organizationId)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filterBuilder = Builders<EmailTemplate>.Filter;
            var filter = filterBuilder.In(t => t.ItemId, templateIds) & filterBuilder.Not(OfOrganization(organizationId));

            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailTemplateRepository.CountOutsideOrganizationAsync");
            // Without read access the organization check (C3) can't be made, so the assignment is refused, as a
            // refused update is.
            if (!scope.Granted)
                throw new UnauthorizedAccessException("Access to the email templates was denied by the data access policy.");
            return await collection.CountDocumentsAsync(scope.Filter);
        }

        public async Task<int> AssignConfigurationAsync(string configurationId, string organizationId, IReadOnlyCollection<string>? templateIds, string? searchKey, string? language)
        {
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filterBuilder = Builders<EmailTemplate>.Filter;

            // The organization is always part of the filter, so no id can reach another organization's template;
            // templates already on the configuration are not touched, so they are not counted either.
            var filter = OfOrganization(organizationId)
                & (templateIds != null ? filterBuilder.In(t => t.ItemId, templateIds) : Matching(searchKey, language))
                & filterBuilder.Ne(t => t.MailConfigurationId, configurationId);

            const string callSite = "MailTemplateRepository.AssignConfigurationAsync";
            var editFilter = await _dataAccess.EditFilterAsync(OsSchemas.EmailTemplate, filter, callSite);
            if (editFilter is null)
                throw new UnauthorizedAccessException("Access to the email templates was denied by the data access policy.");

            // Only the configuration and the last-updated fields change: name, language, body, organization and
            // CreatedFromDefault stay as they are.
            var update = Builders<EmailTemplate>.Update
                .Set(t => t.MailConfigurationId, configurationId)
                .Set(t => t.LastUpdatedDate, DateTime.UtcNow)
                .Set(t => t.LastUpdatedBy, BlocksContext.GetContext()?.UserId ?? "no_user");
            await _dataAccess.CheckUpdateAsync(OsSchemas.EmailTemplate, update, callSite);

            var result = await collection.UpdateManyAsync(editFilter, update);
            return (int)result.ModifiedCount;
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

        public async Task<List<EmailTemplate>> GetOrganizationCopiesAsync(string name, string language, IReadOnlyCollection<string> organizationIds)
        {
            var organizations = OrganizationsOnly(organizationIds);
            if (organizations.Count == 0)
            {
                return [];
            }

            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, CopiesOf(name, language, organizations),
                "MailTemplateRepository.GetOrganizationCopiesAsync", useProjection: false);
            return scope.Granted ? await scope.Apply(collection).SortBy(t => t.OrganizationId).ToListAsync() : [];
        }

        public async Task<OrganizationCopyBatchResult> WriteOrganizationCopiesAsync(EmailTemplate source, IReadOnlyCollection<string> organizationIds, bool replace, string tenantId, string userId)
        {
            ArgumentNullException.ThrowIfNull(source);
            const string callSite = "MailTemplateRepository.WriteOrganizationCopiesAsync";
            var collection = _dbContextProvider.GetCollection<EmailTemplate>(CollectionName);
            var filterBuilder = Builders<EmailTemplate>.Filter;
            var name = source.Name ?? string.Empty;
            var language = source.Language ?? string.Empty;
            var organizations = OrganizationsOnly(organizationIds);
            var result = new OrganizationCopyBatchResult();
            if (organizations.Count == 0)
            {
                return result;
            }

            // One read: which of the batch's organizations already have this Name + Language.
            var scope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, CopiesOf(name, language, organizations), callSite, useProjection: false);
            if (!scope.Granted)
                throw new UnauthorizedAccessException("Access to the email templates was denied by the data access policy.");
            var existing = (await scope.Apply(collection).ToListAsync())
                .GroupBy(t => t.OrganizationId, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.Select(t => t.ItemId).ToList(), StringComparer.Ordinal);

            var gate = await _dataAccess.EditFilterAsync(OsSchemas.EmailTemplate, filterBuilder.Empty, callSite);
            if (gate is null || !await _dataAccess.InsertAllowedAsync(OsSchemas.EmailTemplate, callSite))
                throw new UnauthorizedAccessException("Access to the email templates was denied by the data access policy.");

            var now = DateTime.UtcNow;
            var replaceUpdate = Builders<EmailTemplate>.Update
                .Set(t => t.TemplateSubject, source.TemplateSubject)
                .Set(t => t.TemplateBody, source.TemplateBody)
                .Set(t => t.JsonContent, source.JsonContent)
                .Set(t => t.ImageId, source.ImageId)
                .Set(t => t.ImageUrl, source.ImageUrl)
                .Set(t => t.LastUpdatedDate, now)
                .Set(t => t.LastUpdatedBy, userId);
            await _dataAccess.CheckUpdateAsync(OsSchemas.EmailTemplate, replaceUpdate, callSite);

            var toCreate = organizations.Where(o => !existing.ContainsKey(o)).ToList();
            var models = new List<WriteModel<EmailTemplate>>();
            foreach (var organizationId in toCreate)
            {
                // The key is in the filter, so a re-delivered message finds the copy instead of adding one; the id is
                // derived from the key, so two jobs inserting at once collide on _id instead (C4).
                var insert = Builders<EmailTemplate>.Update
                    .SetOnInsert(t => t.ItemId, OrganizationCopyIds.For(tenantId, organizationId, name, language))
                    .SetOnInsert(t => t.TemplateSubject, source.TemplateSubject)
                    .SetOnInsert(t => t.TemplateBody, source.TemplateBody)
                    .SetOnInsert(t => t.JsonContent, source.JsonContent)
                    .SetOnInsert(t => t.ImageId, source.ImageId)
                    .SetOnInsert(t => t.ImageUrl, source.ImageUrl)
                    .SetOnInsert(t => t.MailConfigurationId, string.Empty)
                    .SetOnInsert(t => t.CreatedFromDefault, true)
                    .SetOnInsert(t => t.Tags, new List<string>())
                    .SetOnInsert(t => t.CreatedBy, userId)
                    .SetOnInsert(t => t.LastUpdatedBy, userId)
                    .SetOnInsert(t => t.GeneratedBy, userId)
                    .SetOnInsert(t => t.CreatedDate, now)
                    .SetOnInsert(t => t.LastUpdatedDate, now);
                models.Add(new UpdateOneModel<EmailTemplate>(gate & CopyKey(organizationId, name, language), insert) { IsUpsert = true });
            }

            if (replace)
            {
                foreach (var id in existing.Values.SelectMany(ids => ids))
                {
                    models.Add(new UpdateOneModel<EmailTemplate>(gate & filterBuilder.Eq(t => t.ItemId, id), replaceUpdate));
                }
                result.Replaced = existing.Count;
            }
            else
            {
                result.Kept = existing.Count;
            }

            if (models.Count == 0)
            {
                return result;
            }

            var upserted = await BulkWriteAsync(collection, models);
            result.Created = upserted.Count;

            // An insert that found the copy already there was beaten by another job between our read and our write:
            // that organization now has a copy, so Keep leaves it and Replace overwrites it, as for any existing copy.
            var raced = toCreate.Where((_, index) => !upserted.Contains(index)).ToList();
            if (raced.Count > 0)
            {
                if (replace)
                {
                    await collection.UpdateManyAsync(gate & filterBuilder.In(t => t.OrganizationId, raced)
                        & filterBuilder.Eq(t => t.Name, name) & filterBuilder.Eq(t => t.Language, language), replaceUpdate);
                    result.Replaced += raced.Count;
                }
                else
                {
                    result.Kept += raced.Count;
                }
            }

            return result;
        }

        /// <summary>
        /// One unordered bulk write; the indexes of the models that inserted. A duplicate <c>_id</c> is not a failure:
        /// another job inserted the same copy first. Any other write error fails the batch.
        /// </summary>
        private static async Task<HashSet<int>> BulkWriteAsync(IMongoCollection<EmailTemplate> collection, List<WriteModel<EmailTemplate>> models)
        {
            const int DuplicateKey = 11000;
            try
            {
                var written = await collection.BulkWriteAsync(models, new BulkWriteOptions { IsOrdered = false });
                return written.Upserts.Select(u => u.Index).ToHashSet();
            }
            catch (MongoBulkWriteException<EmailTemplate> ex) when (ex.WriteErrors.All(e => e.Code == DuplicateKey) && ex.WriteConcernError is null)
            {
                return ex.Result.Upserts.Select(u => u.Index).ToHashSet();
            }
        }

        private static FilterDefinition<EmailTemplate> CopyKey(string organizationId, string name, string language) =>
            Builders<EmailTemplate>.Filter.Eq(t => t.OrganizationId, organizationId)
            & Builders<EmailTemplate>.Filter.Eq(t => t.Name, name)
            & Builders<EmailTemplate>.Filter.Eq(t => t.Language, language);

        private static FilterDefinition<EmailTemplate> CopiesOf(string name, string language, IReadOnlyCollection<string> organizations) =>
            Builders<EmailTemplate>.Filter.Eq(t => t.Name, name)
            & Builders<EmailTemplate>.Filter.Eq(t => t.Language, language)
            & Builders<EmailTemplate>.Filter.In(t => t.OrganizationId, organizations);

        // Copies live in organizations: the Default organization's own template is the source, never a copy.
        private static List<string> OrganizationsOnly(IReadOnlyCollection<string> organizationIds) =>
            organizationIds
                .Where(id => OrganizationIds.Normalize(id) != OrganizationIds.Default)
                .Distinct(StringComparer.Ordinal)
                .ToList();
    }
}




