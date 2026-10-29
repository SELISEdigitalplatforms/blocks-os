using System;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Secrets;
using FluentAssertions;
using Moq;

namespace XUnitTest.Secrets
{
    /// <summary>
    /// The access-control matrix. One case per row of the value-read decision table.
    /// </summary>
    public class SecretAuthorizationTests : IDisposable
    {
        private readonly SecretTestContext _context = new();

        public void Dispose()
        {
            SecretTestContext.SignOut();
            GC.SuppressFinalize(this);
        }

        [Fact]
        public async Task ApiSecret_AllowsAUserOnTheAccessList()
        {
            SecretTestContext.SignIn();
            _context.GivenSecret(access: new SecretAccess { UserIds = { SecretTestContext.UserId } }, createdBy: "someone-else");

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
        }

        [Fact]
        public async Task ApiSecret_AllowsAUserHoldingAnAccessRole()
        {
            SecretTestContext.SignIn(roles: ["secret-reader"]);
            _context.GivenSecret(access: new SecretAccess { Roles = { "secret-reader" } }, createdBy: "someone-else");

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
        }

        [Fact]
        public async Task ApiSecret_RefusesAUserOnNeitherList()
        {
            SecretTestContext.SignIn(roles: ["viewer"]);
            _context.GivenSecret(
                access: new SecretAccess { UserIds = { "other-user" }, Roles = { "admin" } },
                createdBy: "someone-else");

            var act = () => _context.Service.GetValueAsync("secret-1");

            (await act.Should().ThrowAsync<SecretAccessDeniedException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.NotInAccessList);

            _context.AuditFor(SecretAuditActions.AccessDenied).Should().ContainSingle();
        }

        [Fact]
        public async Task ApiSecret_WithAnEmptyAccessList_MeansNobodyRatherThanEverybody()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(access: new SecretAccess(), createdBy: "someone-else");

            var act = () => _context.Service.GetValueAsync("secret-1");

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }

        [Fact]
        public async Task ApiSecret_WithAnEmptyAccessList_StillAllowsItsCreator()
        {
            // Otherwise creating a secret without naming yourself would orphan it immediately.
            SecretTestContext.SignIn();
            _context.GivenSecret(access: new SecretAccess(), createdBy: SecretTestContext.UserId);

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
        }

        [Fact]
        public async Task ServiceSecret_NeedsOnlyAValidContext()
        {
            SecretTestContext.SignIn(userId: "any-service-user");
            _context.GivenSecret(type: SecretTypes.Service, access: null, createdBy: "someone-else");

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
        }

        [Theory]
        [InlineData(SecretStatuses.Locked)]
        [InlineData(SecretStatuses.Deleted)]
        public async Task NonActiveSecrets_AreUnreadable(string status)
        {
            SecretTestContext.SignIn();
            _context.GivenSecret(status: status, access: new SecretAccess { UserIds = { SecretTestContext.UserId } });

            var act = () => _context.Service.GetValueAsync("secret-1");

            (await act.Should().ThrowAsync<SecretStateException>())
                .Which.CurrentStatus.Should().Be(status);
        }

        [Theory]
        [InlineData(SecretStatuses.Locked)]
        [InlineData(SecretStatuses.Deleted)]
        public async Task NonActiveSecrets_AreUnreadableEvenByRoot(string status)
        {
            // Root bypasses the access list, not the lifecycle.
            SecretTestContext.SignIn(tenantId: SecretTestContext.RootTenantId);
            _context.GivenSecret(status: status, tenantId: SecretTestContext.RootTenantId);

            var act = () => _context.Service.GetValueAsync("secret-1");

            await act.Should().ThrowAsync<SecretStateException>();
        }

        [Fact]
        public async Task Root_BypassesTheAccessListAndIsAudited()
        {
            SecretTestContext.SignIn(tenantId: SecretTestContext.RootTenantId, userId: "root-admin");
            _context.GivenSecret(
                access: new SecretAccess { UserIds = { "someone-else" } },
                createdBy: "someone-else",
                tenantId: SecretTestContext.RootTenantId);

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");
            _context.AuditFor(SecretAuditActions.GetValue).Should().ContainSingle()
                    .Which.IsRootOverride.Should().BeTrue();
        }

        [Fact]
        public async Task RootImpersonatingATenant_BypassesTheAccessListAndRecordsTheSession()
        {
            SecretTestContext.SignIn(
                tenantId: SecretTestContext.TenantId,
                userId: "root-admin",
                impersonated: true,
                originalTenantId: SecretTestContext.RootTenantId);

            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            var value = await _context.Service.GetValueAsync("secret-1");

            value.Should().Be("hunter2");

            var audit = _context.AuditFor(SecretAuditActions.GetValue).Should().ContainSingle().Subject;
            audit.IsRootOverride.Should().BeTrue();
            audit.Impersonated.Should().BeTrue();
            audit.ImpersonationSessionId.Should().Be("session-1");
        }

        [Fact]
        public async Task ImpersonationFromANonRootTenant_ConfersNothing()
        {
            SecretTestContext.SignIn(
                userId: "nosy-admin",
                impersonated: true,
                originalTenantId: "another-ordinary-tenant");

            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            var act = () => _context.Service.GetValueAsync("secret-1");

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }

        [Fact]
        public async Task ATenantCacheFailure_DoesNotGrantRoot()
        {
            _context.Tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Throws(new InvalidOperationException("cache down"));

            SecretTestContext.SignIn();
            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            var act = () => _context.Service.GetValueAsync("secret-1");

            await act.Should().ThrowAsync<SecretAccessDeniedException>();
        }

        [Fact]
        public async Task ASecretFromAnotherTenant_Reads404NotForbidden()
        {
            // 403 would confirm the id exists and leak the shape of another tenant's data.
            SecretTestContext.SignIn();
            _context.Repository
                    .Setup(r => r.GetAsync(SecretTestContext.TenantId, "other-tenant-secret", It.IsAny<CancellationToken>()))
                    .ReturnsAsync((Secret?)null);

            var act = () => _context.Service.GetValueAsync("other-tenant-secret");

            await act.Should().ThrowAsync<SecretNotFoundException>();
        }

        [Fact]
        public async Task NoContext_IsARefusal()
        {
            SecretTestContext.SignOut();

            var act = () => _context.Service.GetValueAsync("secret-1");

            (await act.Should().ThrowAsync<SecretAccessDeniedException>())
                .Which.ReasonCode.Should().Be(SecretAuditReasons.NoContext);
        }

        [Fact]
        public void AContextWithoutATenant_IsARefusal()
        {
            BlocksContext.SetContext(BlocksContext.Create(
                tenantId: null, roles: [], userId: "u", isAuthenticated: true, requestUri: null,
                organizationId: null, expireOn: DateTime.UtcNow.AddHours(1), email: null, permissions: [],
                userName: null, phoneNumber: null, displayName: null, oauthToken: null, originalTenantId: null));

            var act = () => _context.Authorization.ResolveContext();

            act.Should().Throw<SecretAccessDeniedException>()
               .Which.ReasonCode.Should().Be(SecretAuditReasons.InvalidContext);
        }

        [Fact]
        public async Task CanReadValue_IsPreEvaluatedOnMetadata()
        {
            SecretTestContext.SignIn(userId: "unrelated-user");
            _context.GivenSecret(access: new SecretAccess { UserIds = { "someone-else" } }, createdBy: "someone-else");

            var result = await _context.Service.GetAsync("secret-1");

            result!.CanReadValue.Should().BeFalse();
        }
    }
}
