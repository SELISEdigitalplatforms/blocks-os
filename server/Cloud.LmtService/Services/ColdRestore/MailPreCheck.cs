using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.RegularExpressions;
using Os.DataAccess;

namespace Cloud.LmtService.Services.ColdRestore
{
    /// <summary>
    /// Runs, before a mail is queued, the same checks the retired mail driver (4.0.0) ran in the request on the context
    /// tenant DB: the Default organization's template for purpose + language, a mail server configuration it can send
    /// through (its own, the Default organization's default or the project default), and (only for
    /// mail to registered users) at least one recipient that is a registered user.
    /// </summary>
    public static class MailPreCheck
    {
        /// <summary>Returns the name of the first failed check, or null when the mail may be queued.</summary>
        public static async Task<string?> FindFailureAsync(
            IDbContextProvider dbContextProvider,
            IOsDataAccess dataAccess,
            string? purpose,
            string? language,
            IEnumerable<string>? to,
            bool sendPhoneNumberAsEmail,
            IReadOnlyDictionary<string, string>? bodyDataContext = null)
        {
            var argumentFailure = FindArgumentFailure(purpose, language, to, out var recipients);
            if (argumentFailure != null)
            {
                return argumentFailure;
            }

            var template = await FindTemplateAsync(dbContextProvider, dataAccess, purpose!, language!);
            if (template == null)
            {
                return "no email template for purpose and language";
            }

            if (!await HasMailServerConfigurationAsync(dbContextProvider, dataAccess, template))
            {
                return "no mail server configuration for the template";
            }

            if (IsPlaceholderMissing(template, bodyDataContext))
            {
                return "body data is missing a placeholder of the template";
            }

            if (!sendPhoneNumberAsEmail && !await HasRegisteredRecipientAsync(dbContextProvider, recipients!))
            {
                return "recipient is not a registered user";
            }

            return null;
        }

        private static string? FindArgumentFailure(string? purpose, string? language, IEnumerable<string>? to, out List<string>? recipients)
        {
            recipients = null;
            if (string.IsNullOrWhiteSpace(BlocksContext.GetContext()?.TenantId))
            {
                return "no tenant context";
            }

            if (string.IsNullOrWhiteSpace(purpose))
            {
                return "purpose is required";
            }

            if (string.IsNullOrWhiteSpace(language))
            {
                return "language is required";
            }

            recipients = to?.ToList();
            if (recipients == null || recipients.Count == 0 || recipients.Contains(null!))
            {
                return "no recipient";
            }

            return null;
        }

        // Stored values that mean the Default organization: "default", empty, null or no element at all
        // (an $in on null also matches a missing element). Configuration.DomainService's OrganizationIds
        // holds the same rule; this project doesn't reference it.
        private static readonly BsonArray DefaultOrganizationValues = new() { "default", "", BsonNull.Value };

        private static FilterDefinition<BsonDocument> OfDefaultOrganization =>
            new BsonDocument("OrganizationId", new BsonDocument("$in", DefaultOrganizationValues));

        /// <summary>
        /// The Default organization's template for purpose + language, as blocks-logic's queue picks it: of several,
        /// the lowest id. Organizations' own templates are only used by logic's org-aware send, not here.
        /// </summary>
        private static async Task<BsonDocument?> FindTemplateAsync(IDbContextProvider dbContextProvider, IOsDataAccess dataAccess, string purpose, string language)
        {
            var templates = dbContextProvider.GetCollection<BsonDocument>("EmailTemplates");
            var filter = Builders<BsonDocument>.Filter.Eq("Name", purpose)
                         & Builders<BsonDocument>.Filter.Eq("Language", language)
                         & OfDefaultOrganization;
            var scope = await dataAccess.ReadAsync(OsSchemas.EmailTemplate, filter, "MailPreCheck.FindTemplateAsync");
            return scope.Granted
                ? await scope.Apply(templates).Sort(Builders<BsonDocument>.Sort.Ascending("_id")).Limit(1).FirstOrDefaultAsync()
                : null;
        }

        /// <summary>
        /// Whether logic would find a configuration for the template: the template's own, else the Default
        /// organization's organization default, else the project default. Inbound configurations never send.
        /// </summary>
        private static async Task<bool> HasMailServerConfigurationAsync(IDbContextProvider dbContextProvider, IOsDataAccess dataAccess, BsonDocument template)
        {
            var configId = template.TryGetValue("MailConfigurationId", out var idValue) && idValue.IsString ? idValue.AsString : null;
            var builder = Builders<BsonDocument>.Filter;
            var candidates = new List<FilterDefinition<BsonDocument>>
            {
                builder.Eq("IsOrganizationDefault", true) & OfDefaultOrganization,
                builder.Eq("IsDefault", true)
            };
            if (!string.IsNullOrEmpty(configId))
            {
                candidates.Add(builder.Eq("_id", configId));
            }

            var configs = dbContextProvider.GetCollection<BsonDocument>("MailServerConfigurations");
            // One read for the whole chain. No projection: the system schema may not list IsOrganizationDefault.
            var scope = await dataAccess.ReadAsync(OsSchemas.MailServerConfiguration,
                builder.Ne("IsInbound", true) & builder.Or(candidates), "MailPreCheck.HasMailServerConfigurationAsync", useProjection: false);
            if (!scope.Granted)
            {
                return false;
            }

            var config = await scope.Apply(configs).Limit(1).FirstOrDefaultAsync();
            return config != null;
        }

        // The driver also failed when the body data lacked a {{key}} / {{x:key}} placeholder of the template body.
        private static bool IsPlaceholderMissing(BsonDocument template, IReadOnlyDictionary<string, string>? bodyDataContext)
        {
            var body = template.TryGetValue("TemplateBody", out var bodyValue) && bodyValue.IsString ? bodyValue.AsString : null;
            if (string.IsNullOrEmpty(body))
            {
                return false;
            }

            var keys = Regex.Matches(body, "\\{{(?:.:)?(.*?)\\}}", RegexOptions.None, TimeSpan.FromMilliseconds(500))
                .Select(m => m.Groups[1].Value).Distinct().ToList();
            return keys.Count > 0 && (bodyDataContext == null || keys.Exists(k => !bodyDataContext.ContainsKey(k)));
        }

        private static async Task<bool> HasRegisteredRecipientAsync(IDbContextProvider dbContextProvider, List<string> recipients)
        {
            var users = dbContextProvider.GetCollection<BsonDocument>("Users");
            var user = await (await users.FindAsync(
                Builders<BsonDocument>.Filter.In("Email", recipients),
                new FindOptions<BsonDocument> { Limit = 1 })).FirstOrDefaultAsync();
            return user != null;
        }
    }
}
