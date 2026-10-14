using Blocks.Genesis;
using MongoDB.Bson;
using MongoDB.Driver;
using System.Text.RegularExpressions;

namespace DomainService.Migration
{
    /// <summary>
    /// Runs, before a mail is queued, the same checks the retired mail driver (4.0.0) ran in the request on the context
    /// tenant DB: a template for purpose + language, the mail server configuration of that template, and (only for
    /// mail to registered users) at least one recipient that is a registered user.
    /// </summary>
    public static class MailPreCheck
    {
        /// <summary>Returns the name of the first failed check, or null when the mail may be queued.</summary>
        public static async Task<string?> FindFailureAsync(
            IDbContextProvider dbContextProvider,
            string? purpose,
            string? language,
            IEnumerable<string>? to,
            bool sendPhoneNumberAsEmail,
            IReadOnlyDictionary<string, string>? bodyDataContext = null)
        {
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

            var recipients = to?.ToList();
            if (recipients == null || recipients.Count == 0 || recipients.Any(r => r == null))
            {
                return "no recipient";
            }

            var templates = dbContextProvider.GetCollection<BsonDocument>("EmailTemplates");
            // Like the driver: a template for the caller's organization first, then any with purpose + language.
            var nameAndLanguage = Builders<BsonDocument>.Filter.Eq("Name", purpose) & Builders<BsonDocument>.Filter.Eq("Language", language);
            BsonDocument? template = null;
            var organizationId = BlocksContext.GetContext()?.OrganizationId;
            if (!string.IsNullOrWhiteSpace(organizationId))
            {
                template = await (await templates.FindAsync(
                    nameAndLanguage & Builders<BsonDocument>.Filter.In("OrganizationIds", new[] { organizationId }),
                    new FindOptions<BsonDocument> { Limit = 1 })).FirstOrDefaultAsync();
            }
            template ??= await (await templates.FindAsync(
                nameAndLanguage,
                new FindOptions<BsonDocument> { Limit = 1 })).FirstOrDefaultAsync();
            if (template == null)
            {
                return "no email template for purpose and language";
            }

            var configId = template.TryGetValue("MailConfigurationId", out var idValue) && idValue.IsString ? idValue.AsString : null;
            if (string.IsNullOrEmpty(configId))
            {
                return "no mail server configuration for the template";
            }

            var configs = dbContextProvider.GetCollection<BsonDocument>("MailServerConfigurations");
            var config = await (await configs.FindAsync(
                Builders<BsonDocument>.Filter.Eq("_id", configId),
                new FindOptions<BsonDocument> { Limit = 1 })).FirstOrDefaultAsync();
            if (config == null)
            {
                return "no mail server configuration for the template";
            }

            // The driver also failed when the body data lacked a {{key}} / {{x:key}} placeholder of the template body.
            var body = template.TryGetValue("TemplateBody", out var bodyValue) && bodyValue.IsString ? bodyValue.AsString : null;
            if (!string.IsNullOrEmpty(body))
            {
                var keys = Regex.Matches(body, "\\{{(?:.:)?(.*?)\\}}", RegexOptions.None, TimeSpan.FromMilliseconds(500))
                    .Select(m => m.Groups[1].Value).Distinct().ToList();
                if (keys.Count > 0 && (bodyDataContext == null || keys.Any(k => !bodyDataContext.ContainsKey(k))))
                {
                    return "body data is missing a placeholder of the template";
                }
            }

            if (!sendPhoneNumberAsEmail)
            {
                var users = dbContextProvider.GetCollection<BsonDocument>("Users");
                var user = await (await users.FindAsync(
                    Builders<BsonDocument>.Filter.In("Email", recipients),
                    new FindOptions<BsonDocument> { Limit = 1 })).FirstOrDefaultAsync();
                if (user == null)
                {
                    return "recipient is not a registered user";
                }
            }

            return null;
        }
    }
}
