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

            // Replace: one update for every existing copy of the batch, in the same bulk write as the inserts.
            var existingOrganizations = existing.Keys.ToList();
            var existingCopies = existing.Values.Sum(ids => ids.Count);
            if (replace && existingOrganizations.Count > 0)
            {
                models.Add(new UpdateManyModel<EmailTemplate>(gate & CopiesOf(name, language, existingOrganizations), replaceUpdate));
            }

            var written = models.Count == 0 ? BulkOutcome.None : await BulkWriteAsync(collection, models);
            result.Created = written.Upserted.Count;

            // An insert that didn't insert lost to another job between our read and our write (it matched the key, or hit
            // the derived _id). Those organizations most likely have a copy now; the re-read below says for sure.
            var raced = toCreate.Where((_, index) => !written.Upserted.Contains(index)).ToList();
            var racedWithoutError = raced.Count - toCreate.Where((_, index) => written.Failed.Contains(index)).Count();

            // MatchedCount covers the replace update and the inserts that found the key instead of inserting.
            var replaceMatched = written.Matched - racedWithoutError;
            var recheck = new List<string>(raced);
            if (replace)
            {
                if (replaceMatched >= existingCopies)
                    result.Replaced = existingOrganizations.Count;
                else
                    recheck.AddRange(existingOrganizations); // some copies were gone by the time of the write
            }
            else
            {
                result.Kept = existingOrganizations.Count;
            }

            if (recheck.Count == 0)
            {
                return result;
            }

            // Raced organizations: Replace overwrites the copy the other job made; its own update, so a failure here only
            // fails these organizations, not the inserts that already landed.
            var racedReplaced = true;
            if (replace && raced.Count > 0)
            {
                try
                {
                    await collection.UpdateManyAsync(gate & CopiesOf(name, language, raced), replaceUpdate);
                }
#pragma warning disable CA1031 // C5: only the raced organizations failed; the batch's other writes stand.
                catch (Exception ex)
#pragma warning restore CA1031
                {
                    racedReplaced = false;
                    result.RacedReplaceErrorType = ex.GetType().Name;
                }
            }

            // One read of the organizations whose outcome the write couldn't tell: a copy there is kept or replaced; none
            // there (a deleted copy, or a derived _id already used by another document) means that organization failed.
            var recheckScope = await _dataAccess.ReadAsync(OsSchemas.EmailTemplate, CopiesOf(name, language, recheck.Distinct(StringComparer.Ordinal).ToList()), callSite, useProjection: false);
            if (!recheckScope.Granted)
                throw new UnauthorizedAccessException("Access to the email templates was denied by the data access policy.");
            var present = (await recheckScope.Apply(collection).ToListAsync())
                .Select(t => t.OrganizationId)
                .ToHashSet(StringComparer.Ordinal);
            foreach (var organizationId in recheck.Distinct(StringComparer.Ordinal))
            {
                var isRaced = raced.Contains(organizationId, StringComparer.Ordinal);
                if (!present.Contains(organizationId) || (isRaced && replace && !racedReplaced))
                {
                    result.Failed++;
                    result.FailedOrganizationIds.Add(organizationId);
                }
                else if (replace)
                    result.Replaced++;
                else
                    result.Kept++;
            }

            return result;
        }

        /// <summary>What one unordered bulk write did: the models that inserted, those that failed on a duplicate key, and how many documents its updates matched.</summary>
        private sealed record BulkOutcome(HashSet<int> Upserted, HashSet<int> Failed, long Matched)
        {
            public static readonly BulkOutcome None = new([], [], 0);
        }

        /// <summary>
        /// One unordered bulk write; the indexes of the models that inserted. A duplicate <c>_id</c> is not a failure:
        /// another job inserted the same copy first. Any other write error fails the batch.
        /// </summary>
        private static async Task<BulkOutcome> BulkWriteAsync(IMongoCollection<EmailTemplate> collection, List<WriteModel<EmailTemplate>> models)
        {
            const int DuplicateKey = 11000;
            try
            {
                var written = await collection.BulkWriteAsync(models, new BulkWriteOptions { IsOrdered = false });
                return new BulkOutcome(written.Upserts.Select(u => u.Index).ToHashSet(), [], written.MatchedCount);
            }
            catch (MongoBulkWriteException<EmailTemplate> ex) when (ex.WriteErrors.All(e => e.Code == DuplicateKey) && ex.WriteConcernError is null)
            {
                return new BulkOutcome(
                    ex.Result.Upserts.Select(u => u.Index).ToHashSet(),
                    ex.WriteErrors.Select(e => e.Index).ToHashSet(),
                    ex.Result.IsAcknowledged ? ex.Result.MatchedCount : 0);
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




