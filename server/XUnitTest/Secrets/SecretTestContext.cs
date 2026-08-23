using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// Wires a <see cref="SecretService"/> with mocked collaborators and a controllable caller.
    /// </summary>
    /// <remarks>
    /// Uses the real <see cref="SecretAuthorizationService"/> rather than a mock: the access
    /// rules are the thing under test in most of these cases, and a mocked authorizer would
    /// only assert that the service calls something.
    /// </remarks>
    internal sealed class SecretTestContext
    {
        public const string TenantId = "tenant-1";
        public const string RootTenantId = "root-tenant";
        public const string UserId = "user-1";

        public Mock<ISecretRepository> Repository { get; } = new();
        public Mock<ISecretAuditRepository> AuditRepository { get; } = new();
        public Mock<ISecretValueStore> ValueStore { get; } = new();
        public Mock<ITenants> Tenants { get; } = new();
        public List<SecretAuditLog> AuditLog { get; } = new();

        public ISecretService Service { get; }
        public ISecretAuthorizationService Authorization { get; }

        public SecretTestContext()
        {
            Tenants.Setup(t => t.GetTenantByID(TenantId)).Returns(NewTenant(TenantId, isRoot: false));
            Tenants.Setup(t => t.GetTenantByID(RootTenantId)).Returns(NewTenant(RootTenantId, isRoot: true));

            AuditRepository
                .Setup(r => r.InsertAsync(It.IsAny<SecretAuditLog>(), It.IsAny<CancellationToken>()))
                .Callback<SecretAuditLog, CancellationToken>((log, _) => AuditLog.Add(log))
                .Returns(Task.CompletedTask);

            // Without this, Moq's default for the tuple return hands back a null list rather
            // than an empty one, which no real repository ever does.
            Repository
                .Setup(r => r.FindAsync(It.IsAny<string>(), It.IsAny<SecretFilter>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Array.Empty<Secret>(), 0L));

            AuditRepository
                .Setup(r => r.FindAsync(It.IsAny<string>(), It.IsAny<SecretAuditFilter>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((Array.Empty<SecretAuditLog>(), 0L));

            Authorization = new SecretAuthorizationService(Tenants.Object);

            var audit = new SecretAuditService(AuditRepository.Object, NullLogger<SecretAuditService>.Instance);

            Service = new SecretService(
                Repository.Object,
                AuditRepository.Object,
                ValueStore.Object,
                Authorization,
                audit,
                NullLogger<SecretService>.Instance);
        }

        /// <summary>Installs a caller context for the duration of the test.</summary>
        public static void SignIn(
            string tenantId = TenantId,
            string userId = UserId,
            IEnumerable<string>? roles = null,
            bool impersonated = false,
            string? originalTenantId = null)
        {
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId: tenantId,
                roles: roles ?? [],
                userId: userId,
                isAuthenticated: true,
                requestUri: "/api/secrets/value",
                organizationId: "default",
                expireOn: DateTime.UtcNow.AddHours(1),
                email: "user@example.com",
                permissions: [],
                userName: "user",
                phoneNumber: null,
                displayName: "User",
                oauthToken: null,
                originalTenantId: originalTenantId ?? tenantId,
                applicationDomain: null,
                impersonated: impersonated,
                impersonationSessionId: impersonated ? "session-1" : ""));
        }

        public static void SignOut() => BlocksContext.SetContext(null);

        public SecretCallerContext Caller() => Authorization.ResolveContext();

        public Secret GivenSecret(
            string secretId = "secret-1",
            string type = SecretTypes.Api,
            string status = SecretStatuses.Active,
            SecretAccess? access = null,
            string createdBy = UserId,
            string tenantId = TenantId)
        {
            var secret = new Secret
            {
                ItemId = secretId,
                TenantId = tenantId,
                OrganizationId = "default",
                Name = "api-key",
                NameLower = "api-key",
                Type = type,
                Status = status,
                Access = access,
                CreatedBy = createdBy,
                CreatedDate = DateTime.UtcNow,
                LastUpdatedDate = DateTime.UtcNow
            };

            Repository.Setup(r => r.GetAsync(tenantId, secretId, It.IsAny<CancellationToken>())).ReturnsAsync(secret);
            ValueStore.Setup(v => v.GetAsync(secretId, It.IsAny<CancellationToken>())).ReturnsAsync("hunter2");

            return secret;
        }

        private static Tenant NewTenant(string tenantId, bool isRoot) => new()
        {
            TenantId = tenantId,
            IsRootTenant = isRoot,
            DbConnectionString = "mongodb://localhost/test",
            JwtTokenParameters = new JwtTokenParameters
            {
                IssueDate = DateTime.UtcNow,
                PrivateCertificatePassword = string.Empty
            }
        };

        public IEnumerable<SecretAuditLog> AuditFor(string action) =>
            AuditLog.Where(l => l.Action == action);
    }
}
