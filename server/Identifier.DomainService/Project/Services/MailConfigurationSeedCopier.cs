using Blocks.Genesis;
using Blocks.Genesis.Entities.Os;
using Blocks.Secrets;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace DomainService.Projects
{
    /// <summary>
    /// Gives a new project the mail configurations of the seed DB (<c>BlocksConfiguration</c>), each with a secret of the
    /// project's own tenant. blocks-logic reads a configuration's secret in the tenant whose database holds it, and the
    /// seed's references name secrets of the root tenant, so a raw copy would leave the project unable to send. The value
    /// is read in the root tenant (or taken from a seed document that still holds its password) and stored again for the
    /// project; the project's document gets that reference and never a plaintext password.
    /// </summary>
    /// <remarks>
    /// Same <c>_id</c> as the seed: the copied <c>EmailTemplates</c> point at it. A document the project already has is
    /// left as it is and gets no secret, so a retry after a crash makes no duplicate.
    /// </remarks>
    public interface IMailConfigurationSeedCopier
    {
        /// <param name="rootTenantId">
        /// The tenant that holds the seed's secrets. Missing = a seed reference cannot be read, and that configuration is
        /// copied without its credential (logged as an error).
        /// </param>
        /// <exception cref="SecretVaultException">
        /// The secret store is unreachable. Project setup fails and can be retried; nothing half-done is left behind.
        /// </exception>
        Task CopyAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string? rootTenantId, string projectTenantId, string? createdBy);
    }

    public sealed class MailConfigurationSeedCopier : IMailConfigurationSeedCopier
    {
        public const string CollectionName = "MailServerConfigurations";

        // Secret names and descriptions match Configuration.DomainService.Mail.Providers (this project does not
        // reference it), so the console shows a copied secret the same as one it saved.
        public const string PasswordSecretName = "mail-password";
        public const string ClientSecretName = "office365-smtp";
        public const string SecretOrganizationId = "default";
        public const string ServiceUserId = "blocks-os-mail-seed";

        /// <summary>The failure type logged when a seed reference cannot be read because no root tenant is configured.</summary>
        public const string NoRootTenantFailure = "RootTenantIdNotConfigured";

        private const string PasswordField = "AccountPassword";
        private const string PasswordReferenceField = "AccountPasswordReference";
        private const string ClientSecretReferenceField = "ClientSecretReference";
        private const string AuthenticationTypeField = "AuthenticationType";

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<MailConfigurationSeedCopier> _logger;

        public MailConfigurationSeedCopier(IServiceScopeFactory scopeFactory, ILogger<MailConfigurationSeedCopier>? logger = null)
        {
            _scopeFactory = scopeFactory;
            _logger = logger ?? NullLogger<MailConfigurationSeedCopier>.Instance;
        }

        public async Task CopyAsync(IMongoDatabase seedDb, IMongoDatabase projectDb, string? rootTenantId, string projectTenantId, string? createdBy)
        {
            var seedDocuments = await seedDb.GetCollection<BsonDocument>(CollectionName)
                .Find(FilterDefinition<BsonDocument>.Empty)
                .ToListAsync();
            if (seedDocuments.Count == 0)
                return;

            var target = projectDb.GetCollection<BsonDocument>(CollectionName);
            var existingIds = (await target
                    .Find(Builders<BsonDocument>.Filter.In("_id", seedDocuments.Select(d => d["_id"])))
                    .Project(Builders<BsonDocument>.Projection.Include("_id"))
                    .ToListAsync())
                .Select(d => d["_id"])
                .ToHashSet();

            var copied = new List<string>();
            var skipped = new List<string>();
            var withoutCredential = new List<string>();
            foreach (var seed in seedDocuments)
            {
                var id = seed["_id"].ToString()!;
                if (existingIds.Contains(seed["_id"]))
                {
                    skipped.Add(id);
                    continue;
                }

                var outcome = await CopyOneAsync(seed, target, rootTenantId, projectTenantId, createdBy);
                (outcome switch
                {
                    CopyOutcome.Copied => copied,
                    CopyOutcome.CopiedWithoutCredential => withoutCredential,
                    _ => skipped
                }).Add(id);
            }

            _logger.LogInformation(
                "[mail-config] seed-copy tenant={TenantId} copied={Copied} without-credential={WithoutCredential} skipped={Skipped}",
                projectTenantId, string.Join(",", copied), string.Join(",", withoutCredential), string.Join(",", skipped));
        }

        private async Task<CopyOutcome> CopyOneAsync(
            BsonDocument seed,
            IMongoCollection<BsonDocument> target,
            string? rootTenantId,
            string projectTenantId,
            string? createdBy)
        {
            var copy = seed.DeepClone().AsBsonDocument;
            copy["CreatedBy"] = (BsonValue?)createdBy ?? BsonNull.Value;
            copy["LastUpdatedBy"] = (BsonValue?)createdBy ?? BsonNull.Value;

            // The seed's references belong to the root tenant and its password must not reach the project as plaintext:
            // neither is carried over. The project's own reference is set below when there is a value to store.
            copy.Remove(PasswordReferenceField);
            copy.Remove(ClientSecretReferenceField);
            if (copy.Contains(PasswordField))
                copy[PasswordField] = string.Empty;

            var credential = SeedCredential.Of(seed);
            var (value, failureType) = await ReadSeedValueAsync(credential, rootTenantId);
            if (failureType is not null)
            {
                // The type only: a secret-store exception message can carry the reference.
                _logger.LogError(
                    "[mail-config] seed-copy tenant={TenantId} config={ConfigId} credential=not-copied error={ErrorType} (enter the password in the project's console)",
                    projectTenantId, seed["_id"].ToString(), failureType);
            }

            string? secretId = null;
            if (!string.IsNullOrEmpty(value))
            {
                // Order: secret, then doc. A failed or lost insert deletes the secret this call created.
                secretId = await ExecuteInTenantAsync(projectTenantId, s => s.SetAsync(new SetSecretRequest
                {
                    Name = credential.SecretName,
                    Type = SecretTypes.Service,
                    OrganizationId = SecretOrganizationId,
                    Value = value,
                    Description = credential.Describe(seed["_id"].ToString(), StringOf(seed, "Name"))
                }));
                copy[credential.ReferenceField] = secretId;
            }

            try
            {
                await target.InsertOneAsync(copy);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // A parallel run copied it first: keep that doc, drop our own secret.
                if (secretId is not null)
                    await DeleteOwnSecretAsync(projectTenantId, secretId);
                return CopyOutcome.Skipped;
            }
            catch
            {
                if (secretId is not null)
                    await DeleteOwnSecretAsync(projectTenantId, secretId);
                throw;
            }

            return failureType is null ? CopyOutcome.Copied : CopyOutcome.CopiedWithoutCredential;
        }

        /// <summary>
        /// The seed's value: read in the root tenant when the seed holds a reference, otherwise the document's own
        /// password. A seed secret that is gone or not readable is a failure type, not an exception: one broken seed
        /// configuration must not stop project creation. A vault outage propagates, so setup can be retried.
        /// </summary>
        private async Task<(string? Value, string? FailureType)> ReadSeedValueAsync(SeedCredential credential, string? rootTenantId)
        {
            if (string.IsNullOrEmpty(credential.SeedReference))
                return (credential.SeedPlaintext, null);

            if (string.IsNullOrWhiteSpace(rootTenantId))
                return (null, NoRootTenantFailure);

            try
            {
                return (await ExecuteInTenantAsync(rootTenantId, s => s.GetValueAsync(credential.SeedReference)), null);
            }
            catch (Exception ex) when (ex is SecretNotFoundException or SecretStateException or SecretAccessDeniedException or SecretValidationException)
            {
                return (null, ex.GetType().Name);
            }
        }

        private async Task DeleteOwnSecretAsync(string tenantId, string secretId)
        {
            try
            {
                await ExecuteInTenantAsync(tenantId, async s =>
                {
                    await s.DeleteAsync(secretId);
                    return true;
                });
            }
            catch (Exception ex)
            {
                _logger.LogError("[mail-config] seed-copy own-secret-delete result=failed error={ErrorType} tenant={TenantId}", ex.GetType().Name, tenantId); // NOSONAR S6667 — type only: a secret-store message can carry the reference
            }
        }

        /// <summary>One secret call in a new scope, in a service context of <paramref name="tenantId"/> (the caller is another tenant).</summary>
        private async Task<T> ExecuteInTenantAsync<T>(string tenantId, Func<ISecretService, Task<T>> operation)
        {
            using var scope = _scopeFactory.CreateScope();
            var secretService = scope.ServiceProvider.GetRequiredService<ISecretService>();
            var context = BlocksContext.Create(
                tenantId: tenantId,
                roles: [],
                userId: ServiceUserId,
                isAuthenticated: true,
                requestUri: string.Empty,
                organizationId: SecretOrganizationId,
                expireOn: DateTime.UtcNow.AddMinutes(5),
                email: string.Empty,
                permissions: [],
                userName: ServiceUserId,
                phoneNumber: string.Empty,
                displayName: ServiceUserId,
                oauthToken: string.Empty,
                originalTenantId: tenantId);
            return await BlocksContext.ExecuteInContext(context, () => operation(secretService));
        }

        private static string? StringOf(BsonDocument document, string field) =>
            document.TryGetValue(field, out var value) && value.IsString ? value.AsString : null;

        private enum CopyOutcome { Copied, CopiedWithoutCredential, Skipped }

        /// <summary>
        /// The one credential a configuration has: the account password in password mode (a missing mode is password,
        /// as for every document saved before the field existed), else the Office 365 OAuth client secret.
        /// </summary>
        private sealed record SeedCredential(
            string ReferenceField,
            string SecretName,
            string? SeedReference,
            string? SeedPlaintext,
            Func<string?, string?, string> Describe)
        {
            public static SeedCredential Of(BsonDocument seed) => IsPasswordMode(seed)
                ? new(PasswordReferenceField, PasswordSecretName, StringOf(seed, PasswordReferenceField), StringOf(seed, PasswordField), DescribePassword)
                : new(ClientSecretReferenceField, ClientSecretName, StringOf(seed, ClientSecretReferenceField), null, DescribeClientSecret);

            private static bool IsPasswordMode(BsonDocument seed)
            {
                if (!seed.TryGetValue(AuthenticationTypeField, out var mode) || mode.IsBsonNull)
                    return true;
                if (mode.IsNumeric)
                    return mode.ToInt32() == (int)MailAuthenticationType.Password;
                return mode.IsString
                    && Enum.TryParse<MailAuthenticationType>(mode.AsString, ignoreCase: true, out var parsed)
                    && parsed == MailAuthenticationType.Password;
            }

            // Name the owning configuration and nothing else: a secret description is readable by anyone who can list secrets.
            private static string DescribePassword(string? configurationId, string? configurationName) =>
                string.Concat("Mailbox password for mail configuration ", configurationName, " (", configurationId, ").");

            private static string DescribeClientSecret(string? configurationId, string? configurationName) =>
                string.Concat("SMTP Office 365 client secret for mail configuration ", configurationName, " (", configurationId, ").");
        }
    }
}
