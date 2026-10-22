using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Iam;
using Blocks.Genesis.Entities.Os;
using Blocks.Secrets;
using BlocksOs.Api.Controllers;
using Cloud.LmtService.Models.ColdRestore;
using Cloud.LmtService.Models.Shared;
using Cloud.LmtService.Repositories.ColdRestore;
using Cloud.LmtService.Repositories.Shared;
using Cloud.LmtService.Services.ArchiveAndDelete;
using Cloud.LmtService.Services.ColdRestore;
using DomainService.Access.Services;
using DomainService.Access;
using DomainService.Certificate;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Migration;
using DomainService.Migration.Services;
using DomainService.People;
using DomainService.Projects;
using DomainService.Shared;
using DomainService.Shared.Services;
using FluentAssertions;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Os.DataAccess.Notifications;
using XUnitTest.TestHelpers;
using XUnitTest.TestSupport;
using MigrationCompletionConsumer = global::Worker.Consumers.Migration.MigrationCompletionConsumer;

namespace XUnitTest.Notifications
{
    /// <summary>Records every notification instead of sending it.</summary>
    internal sealed class RecordingSender : IBuiltInNotificationSender
    {
        private readonly TaskCompletionSource _first = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public List<BuiltInNotification> Sent { get; } = [];

        public Task FirstSend => _first.Task;

        public Task<bool> SendAsync(BuiltInNotification notification, CancellationToken cancellationToken = default)
        {
            lock (Sent) Sent.Add(notification);
            _first.TrySetResult();
            return Task.FromResult(true);
        }

        public BuiltInNotification Single(string configurationName) =>
            Sent.Should().ContainSingle(n => n.ConfigurationName == configurationName).Subject;

        public static List<string> Recipients(BuiltInNotification notification) =>
            notification.UserIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id!).Distinct().ToList();
    }

    /// <summary>A real sender whose Notifier always fails: proves an action survives a broken Notifier end to end.</summary>
    internal static class FailingNotifier
    {
        public static BuiltInNotificationSender Sender()
        {
            var http = new Mock<IHttpService>();
            http.Setup(h => h.Post<BuiltInNotificationSender.NotifierResponse>(
                    It.IsAny<object>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<Dictionary<string, string>?>(),
                    It.IsAny<CancellationToken>(), It.IsAny<int?>()))
                .ThrowsAsync(new HttpRequestExceptionStub());

            var tenants = new Mock<ITenants>();
            tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(new Tenant
            {
                TenantId = "t", TenantSalt = "salt", DbConnectionString = "x",
                JwtTokenParameters = new JwtTokenParameters { PrivateCertificatePassword = "p", IssueDate = DateTime.UtcNow }
            });

            return new BuiltInNotificationSender(
                http.Object, Mock.Of<ICryptoService>(), tenants.Object,
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
                {
                    [BuiltInNotificationSender.UrlConfigKey] = "https://notify.test/send"
                }).Build(),
                NullLogger<BuiltInNotificationSender>.Instance);
        }

        private sealed class HttpRequestExceptionStub : Exception;
    }

    // ── os-project-member-removed, os-project-ownership-transferred ─────────────────────────

    public class PeopleNotificationTests
    {
        private readonly Mock<IPeopleRepository> _peopleRepo = new();
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly RecordingSender _sender = new();

        private PeopleService Service(IBuiltInNotificationSender? sender = null) => new(
            Mock.Of<ILogger<PeopleService>>(), _peopleRepo.Object, Mock.Of<IMessageClient>(),
            new ConfigurationBuilder().Build(), Mock.Of<ICacheClient>(), _projectRepo.Object, _tenants.Object,
            sender ?? _sender);

        private void GivenRemovable(bool removed = true)
        {
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(["t1", "t2"]);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync([new User { ItemId = "removed-user", Email = "user@x.com" }]);
            _peopleRepo.Setup(r => r.RemovePeoplesAsync("user@x.com", It.IsAny<List<string>>())).ReturnsAsync(removed);
        }

        private static RemoveAccessRequest Remove() => new() { GroupId = "grp", Email = "user@x.com", TenantIds = ["t1"] };

        [Fact]
        public async Task Removing_a_member_tells_the_removed_user()
        {
            using var _ = new BlocksTestContext(userId: "owner");
            GivenRemovable();

            var response = await Service().RemoveAccessFromProjectAsync(Remove());

            response.IsSuccess.Should().BeTrue();
            var sent = _sender.Single(BuiltInNotificationNames.ProjectMemberRemoved);
            RecordingSender.Recipients(sent).Should().Equal("removed-user");
            sent.Ids["tenantGroupId"].Should().Be("grp");
            sent.Ids["projectKeys"].Should().Be("t1");
            sent.Ids.Values.Should().NotContain("user@x.com", "an email is not sent in the payload");
        }

        [Fact]
        public async Task Nothing_is_sent_when_the_remove_wrote_nothing()
        {
            using var _ = new BlocksTestContext();
            GivenRemovable(removed: false);

            await Service().RemoveAccessFromProjectAsync(Remove());

            _sender.Sent.Should().BeEmpty();
        }

        [Fact]
        public async Task Nothing_is_sent_when_the_user_does_not_exist()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(["t1"]);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>())).ReturnsAsync([]);

            await Service().RemoveAccessFromProjectAsync(Remove());

            _sender.Sent.Should().BeEmpty();
        }

        [Fact]
        public async Task A_failing_notifier_does_not_fail_the_remove()
        {
            using var _ = new BlocksTestContext();
            GivenRemovable();

            var response = await Service(FailingNotifier.Sender()).RemoveAccessFromProjectAsync(Remove());

            response.IsSuccess.Should().BeTrue();
        }

        private void GivenTransferable()
        {
            _peopleRepo.Setup(r => r.GetUserByEmailAsync("new@x.com")).ReturnsAsync(new User { ItemId = "new-owner", Email = "new@x.com" });
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(["t1"]);
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("old-owner", It.IsAny<List<string>>()))
                       .ReturnsAsync([new ProjectPeople { ItemId = "row-1", UserId = "old-owner", TenantId = "t1", IsCreator = true }]);
            _peopleRepo.Setup(r => r.UpdateProjectPeopleOwnerShipAsync(It.IsAny<List<string>>(), It.IsAny<bool>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetProjectPeopleByTenantIdAndUserIdAsync("t1", "new-owner")).ReturnsAsync((ProjectPeople?)null);
            _peopleRepo.Setup(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>())).ReturnsAsync(true);
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);
        }

        [Fact]
        public async Task Transferring_ownership_tells_the_old_and_the_new_owner()
        {
            using var _ = new BlocksTestContext(userId: "old-owner", userName: "owner@x.com");
            GivenTransferable();

            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest { TenantGroupId = "grp", TransferToUserEmail = "new@x.com" });

            response.IsSuccess.Should().BeTrue();
            var sent = _sender.Single(BuiltInNotificationNames.ProjectOwnershipTransferred);
            RecordingSender.Recipients(sent).Should().BeEquivalentTo("old-owner", "new-owner");
            sent.Ids["previousOwnerId"].Should().Be("old-owner");
            sent.Ids["newOwnerId"].Should().Be("new-owner");
            sent.TenantId.Should().BeNull("the caller's tenant is used");
        }

        [Fact]
        public async Task A_refused_transfer_sends_nothing()
        {
            using var _ = new BlocksTestContext(userId: "old-owner", userName: "new@x.com");
            GivenTransferable();

            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest { TenantGroupId = "grp", TransferToUserEmail = "new@x.com" });

            response.IsSuccess.Should().BeFalse();
            _sender.Sent.Should().BeEmpty();
        }
    }

    // ── os-project-access-changed ───────────────────────────────────────────────────────────

    public class ProjectAccessNotificationTests
    {
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly Mock<IPeopleRepository> _peopleRepo = new();
        private readonly RecordingSender _sender = new();

        private ProjectAccessService Service() => new(
            _projectRepo.Object, _peopleRepo.Object, Mock.Of<IKeyValueStore>(), Mock.Of<IHttpContextAccessor>(), _sender);

        private void GivenMember()
        {
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(["t1"]);
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("member", It.IsAny<List<string>>()))
                       .ReturnsAsync([new ProjectPeople { ItemId = "row-1", UserId = "member", TenantId = "t1" }]);
            _peopleRepo.Setup(r => r.UpdateAccessPoliciesAsync(It.IsAny<List<string>>(), It.IsAny<List<string>>())).ReturnsAsync(true);
        }

        [Fact]
        public async Task Saving_access_tells_the_member_whose_grants_changed()
        {
            using var _ = new BlocksTestContext(userId: "owner");
            GivenMember();

            var response = await Service().SaveAccessPolicyAsync(new SaveAccessPolicyRequest { ProjectGroupId = "grp", UserId = "member" });

            response.IsSuccess.Should().BeTrue();
            var sent = _sender.Single(BuiltInNotificationNames.ProjectAccessChanged);
            RecordingSender.Recipients(sent).Should().Equal("member");
            sent.Ids["projectGroupId"].Should().Be("grp");
        }

        [Fact]
        public async Task An_unknown_policy_is_refused_and_sends_nothing()
        {
            using var _ = new BlocksTestContext(userId: "owner");
            GivenMember();

            var response = await Service().SaveAccessPolicyAsync(new SaveAccessPolicyRequest
            {
                ProjectGroupId = "grp", UserId = "member", AccessPolicies = ["nope::view"]
            });

            response.IsSuccess.Should().BeFalse();
            _sender.Sent.Should().BeEmpty();
            _peopleRepo.Verify(r => r.UpdateAccessPoliciesAsync(It.IsAny<List<string>>(), It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task A_non_member_is_refused_and_sends_nothing()
        {
            using var _ = new BlocksTestContext(userId: "owner");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(["t1"]);
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("stranger", It.IsAny<List<string>>())).ReturnsAsync([]);

            var response = await Service().SaveAccessPolicyAsync(new SaveAccessPolicyRequest { ProjectGroupId = "grp", UserId = "stranger" });

            response.IsSuccess.Should().BeFalse();
            _sender.Sent.Should().BeEmpty();
        }
    }

    // ── project owner + caller (secrets, certificates) ──────────────────────────────────────

    public class ProjectChangeNotifierTests
    {
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly RecordingSender _sender = new();

        private ProjectChangeNotifier Notifier() => new(_sender, _projectRepo.Object, NullLogger<ProjectChangeNotifier>.Instance);

        [Fact]
        public async Task Sends_to_the_project_owner_and_the_caller_with_the_project_key()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "caller", originalTenantId: "portal");
            _projectRepo.Setup(r => r.GetOwnerUserIdAsync("project-1")).ReturnsAsync("owner");

            await Notifier().NotifyProjectAdminsAsync(BuiltInNotificationNames.SecretChanged, "secret-rotated", "t", "d",
                new Dictionary<string, string?> { ["secretId"] = "s-1" });

            var sent = _sender.Single(BuiltInNotificationNames.SecretChanged);
            RecordingSender.Recipients(sent).Should().BeEquivalentTo("owner", "caller");
            sent.Ids["projectKey"].Should().Be("project-1");
            sent.Ids["actorUserId"].Should().Be("caller");
            sent.Ids["secretId"].Should().Be("s-1");
            sent.TenantId.Should().BeNull("the sender picks the caller's tenant");
        }

        [Fact]
        public async Task The_owner_acting_is_told_once()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "owner");
            _projectRepo.Setup(r => r.GetOwnerUserIdAsync("project-1")).ReturnsAsync("owner");

            await Notifier().NotifyProjectAdminsAsync(BuiltInNotificationNames.SecretChanged, "secret-locked", "t", "d");

            RecordingSender.Recipients(_sender.Sent.Single()).Should().Equal("owner");
        }

        [Fact]
        public async Task A_failing_owner_lookup_still_tells_the_caller()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "caller");
            _projectRepo.Setup(r => r.GetOwnerUserIdAsync(It.IsAny<string>())).ThrowsAsync(new InvalidOperationException("db down"));

            var act = () => Notifier().NotifyProjectAdminsAsync(BuiltInNotificationNames.CertificateChanged, "certificate-uploaded", "t", "d");

            await act.Should().NotThrowAsync();
            RecordingSender.Recipients(_sender.Sent.Single()).Should().Equal("caller");
        }
    }

    // ── os-secret-changed ───────────────────────────────────────────────────────────────────

    public class SecretChangeNotificationTests
    {
        private readonly Mock<ISecretService> _service = new();
        private readonly Mock<IProjectChangeNotifier> _notifier = new();

        private SecretsController Controller(IProjectChangeNotifier? notifier = null) =>
            new(_service.Object, notifier ?? _notifier.Object) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };

        private void VerifyNotified(string eventName, string secretId) =>
            _notifier.Verify(n => n.NotifyProjectAdminsAsync(
                BuiltInNotificationNames.SecretChanged, eventName, It.IsAny<string>(), It.IsAny<string>(),
                It.Is<IReadOnlyDictionary<string, string?>>(ids => ids["secretId"] == secretId && ids.Count == 1),
                It.IsAny<CancellationToken>()), Times.Once);

        [Fact]
        public async Task Rotate_tells_project_admins_without_the_value()
        {
            await Controller().Rotate(new RotateSecretApiRequest { SecretId = "s-1", Value = "top-secret-value" }, CancellationToken.None);

            VerifyNotified("secret-rotated", "s-1");
            _notifier.Verify(n => n.NotifyProjectAdminsAsync(It.IsAny<string>(), It.IsAny<string>(),
                It.Is<string>(t => t.Contains("top-secret-value")), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()), Times.Never);
            _notifier.Verify(n => n.NotifyProjectAdminsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.Is<string>(d => d.Contains("top-secret-value")),
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Lock_unlock_delete_purge_and_access_each_send_their_event()
        {
            await Controller().Lock(new SecretIdRequest { SecretId = "s-1" }, CancellationToken.None);
            await Controller().Unlock(new SecretIdRequest { SecretId = "s-2" }, CancellationToken.None);
            await Controller().Delete("s-3", CancellationToken.None);
            await Controller().Purge("s-4", CancellationToken.None);
            await Controller().Access(new UpdateSecretAccessApiRequest { SecretId = "s-5" }, CancellationToken.None);

            VerifyNotified("secret-locked", "s-1");
            VerifyNotified("secret-unlocked", "s-2");
            VerifyNotified("secret-deleted", "s-3");
            VerifyNotified("secret-purged", "s-4");
            VerifyNotified("secret-access-changed", "s-5");
        }

        [Fact]
        public async Task A_failed_change_sends_nothing()
        {
            _service.Setup(s => s.RotateAsync("s-1", It.IsAny<RotateSecretRequest>(), It.IsAny<CancellationToken>()))
                    .ThrowsAsync(new SecretValidationException("bad"));

            var act = () => Controller().Rotate(new RotateSecretApiRequest { SecretId = "s-1", Value = "v" }, CancellationToken.None);

            await act.Should().ThrowAsync<SecretValidationException>();
            _notifier.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Reads_and_metadata_edits_send_nothing()
        {
            await Controller().Update(new UpdateSecretApiRequest { SecretId = "s-1", Name = "n" }, CancellationToken.None);
            await Controller().Restore(new SecretIdRequest { SecretId = "s-1" }, CancellationToken.None);

            _notifier.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task A_failing_notifier_does_not_fail_the_rotate()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "caller");
            var notifier = new ProjectChangeNotifier(FailingNotifier.Sender(), Mock.Of<IProjectRepository>(), NullLogger<ProjectChangeNotifier>.Instance);

            var response = await Controller(notifier).Rotate(new RotateSecretApiRequest { SecretId = "s-1", Value = "v" }, CancellationToken.None);

            response.IsSuccess.Should().BeTrue();
        }
    }

    // ── os-certificate-changed ──────────────────────────────────────────────────────────────

    public class CertificateChangeNotificationTests
    {
        private readonly Mock<IProjectChangeNotifier> _notifier = new();
        private readonly Mock<ICertificateUploadService> _upload = new();
        private readonly Mock<IProjectManagementService> _projects = new();

        private ProjectController Projects() => new(
            _projects.Object, Mock.Of<IValidator<CreateProjectRequest>>(), Mock.Of<IValidator<UpdateProjectRequest>>(), _notifier.Object);

        private void VerifyNotified(string eventName, Times times) =>
            _notifier.Verify(n => n.NotifyProjectAdminsAsync(
                BuiltInNotificationNames.CertificateChanged, eventName, It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()), times);

        [Fact]
        public async Task A_successful_upload_tells_project_admins()
        {
            _upload.Setup(u => u.UploadPublicCertificateAsync(It.IsAny<UploadCertificateRequest>()))
                   .ReturnsAsync(new UploadCertificateResponse { IsSuccess = true, DownloadUrl = "https://store/cert.pfx" });

            await new CertificateController(_upload.Object, _notifier.Object).UploadCertificate(null, true, "prov-1");

            _notifier.Verify(n => n.NotifyProjectAdminsAsync(
                BuiltInNotificationNames.CertificateChanged, "certificate-uploaded", It.IsAny<string>(), It.IsAny<string>(),
                It.Is<IReadOnlyDictionary<string, string?>>(ids => ids["providerId"] == "prov-1" && !ids.Values.Contains("https://store/cert.pfx")),
                It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task A_failed_upload_sends_nothing()
        {
            _upload.Setup(u => u.UploadPublicCertificateAsync(It.IsAny<UploadCertificateRequest>()))
                   .ReturnsAsync(new UploadCertificateResponse { IsSuccess = false });

            var result = await new CertificateController(_upload.Object, _notifier.Object).UploadCertificate(null, false);

            result.IsSuccess.Should().BeFalse();
            _notifier.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task Token_validation_update_notifies_only_on_success()
        {
            _projects.SetupSequence(p => p.UpdateTokenValidationParametersAsync(It.IsAny<UpdateTokenValidationParametersRequest>()))
                     .ReturnsAsync(new BaseResponse { IsSuccess = true })
                     .ReturnsAsync(new BaseResponse { IsSuccess = false });

            await Projects().UpdateTokenValidationParameters(new UpdateTokenValidationParametersRequest());
            await Projects().UpdateTokenValidationParameters(new UpdateTokenValidationParametersRequest());

            VerifyNotified("token-validation-updated", Times.Once());
        }

        [Fact]
        public async Task Provider_save_and_delete_name_the_provider()
        {
            _projects.Setup(p => p.SaveThirdPartyJwtProviderAsync(It.IsAny<SaveThirdPartyJwtProviderRequest>()))
                     .ReturnsAsync(new SaveThirdPartyJwtProviderResponse { IsSuccess = true, ItemId = "prov-9" });
            _projects.Setup(p => p.DeleteThirdPartyJwtProviderAsync(It.IsAny<DeleteThirdPartyJwtProviderRequest>()))
                     .ReturnsAsync(new BaseResponse { IsSuccess = true });

            await Projects().SaveThirdPartyJwtProvider(new SaveThirdPartyJwtProviderRequest());
            await Projects().DeleteThirdPartyJwtProvider(new DeleteThirdPartyJwtProviderRequest { ItemId = "prov-8" });

            _notifier.Verify(n => n.NotifyProjectAdminsAsync(BuiltInNotificationNames.CertificateChanged, "third-party-provider-saved",
                It.IsAny<string>(), It.IsAny<string>(), It.Is<IReadOnlyDictionary<string, string?>>(ids => ids["providerId"] == "prov-9"),
                It.IsAny<CancellationToken>()), Times.Once);
            _notifier.Verify(n => n.NotifyProjectAdminsAsync(BuiltInNotificationNames.CertificateChanged, "third-party-provider-deleted",
                It.IsAny<string>(), It.IsAny<string>(), It.Is<IReadOnlyDictionary<string, string?>>(ids => ids["providerId"] == "prov-8"),
                It.IsAny<CancellationToken>()), Times.Once);
        }
    }

    // ── os-custom-domain-status ─────────────────────────────────────────────────────────────

    public class DomainStatusNotificationTests
    {
        private readonly Mock<IDomainManagementService> _service = new();
        private readonly RecordingSender _sender = new();

        private DomainController Controller(IBuiltInNotificationSender? sender = null, Stream? body = null)
        {
            var http = new DefaultHttpContext();
            if (body is not null) http.Response.Body = body;
            return new DomainController(_service.Object, NullLogger<DomainController>.Instance, sender ?? _sender)
            {
                ControllerContext = new ControllerContext { HttpContext = http }
            };
        }

        [Theory]
        [InlineData(true, "domain-setup-finished")]
        [InlineData(false, "domain-setup-failed")]
        public async Task Configure_tells_the_caller_how_it_ended(bool success, string eventName)
        {
            using var _ = new BlocksTestContext(userId: "requester");
            _service.Setup(s => s.ConfigureDomainAsync(It.IsAny<ConfigureDomainRequest>()))
                    .ReturnsAsync(new BaseResponse { IsSuccess = success });

            var result = await Controller().Configure(new ConfigureDomainRequest { CookieDomain = "app.example.com" });

            result.IsSuccess.Should().Be(success);
            var sent = _sender.Single(BuiltInNotificationNames.CustomDomainStatus);
            sent.Event.Should().Be(eventName);
            sent.IsSuccess.Should().Be(success);
            sent.Ids["domain"].Should().Be("app.example.com");
            RecordingSender.Recipients(sent).Should().Equal("requester");
        }

        [Fact]
        public async Task A_missing_domain_is_refused_and_sends_nothing()
        {
            using var _ = new BlocksTestContext();

            await Controller().Configure(new ConfigureDomainRequest { CookieDomain = " " });

            _sender.Sent.Should().BeEmpty();
        }

        [Fact]
        public async Task The_stream_sends_the_final_result_from_its_background_run()
        {
            using var _ = new BlocksTestContext(userId: "requester");
            _service.Setup(s => s.ConfigureDomainWithProgressAsync(It.IsAny<ConfigureDomainRequest>(), It.IsAny<Func<DomainSetupProgress, Task>>()))
                    .ThrowsAsync(new InvalidOperationException("boom"));

            await Controller(body: new MemoryStream()).ConfigureStream(new ConfigureDomainRequest { CookieDomain = "app.example.com" });
            await _sender.FirstSend.WaitAsync(TimeSpan.FromSeconds(10));

            var sent = _sender.Single(BuiltInNotificationNames.CustomDomainStatus);
            sent.IsSuccess.Should().BeFalse();
            sent.Description.Should().NotContain("boom", "error text is not sent");
        }

        [Fact]
        public async Task A_failing_notifier_does_not_fail_configure()
        {
            using var _ = new BlocksTestContext(userId: "requester");
            _service.Setup(s => s.ConfigureDomainAsync(It.IsAny<ConfigureDomainRequest>())).ReturnsAsync(new BaseResponse { IsSuccess = true });

            var result = await Controller(FailingNotifier.Sender()).Configure(new ConfigureDomainRequest { CookieDomain = "app.example.com" });

            result.IsSuccess.Should().BeTrue();
        }
    }

    // ── os-data-migration-failed ────────────────────────────────────────────────────────────

    public class MigrationFailedNotificationTests
    {
        private readonly Mock<IMigrationRepository> _repo = new();
        private readonly Mock<IMigrationService> _service = new();
        private readonly RecordingSender _sender = new();

        private MigrationCompletionConsumer Consumer() => new(
            _repo.Object, NullLogger<MigrationCompletionConsumer>.Instance, _service.Object, _sender,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RootTenantId"] = "root-tenant" }).Build());

        private void Given(MigrationTracker tracker, bool updated = true)
        {
            _repo.Setup(r => r.UpdateServiceStatusAsync(It.IsAny<string>(), It.IsAny<MigrationServiceNames>(), It.IsAny<bool>(), It.IsAny<string?>()))
                 .ReturnsAsync(updated);
            _repo.Setup(r => r.GetMigrationTrackerAsync(It.IsAny<string>())).ReturnsAsync(tracker);
            _service.Setup(s => s.AreAllServicesCompleted(It.IsAny<MigrationTracker>()))
                    .Returns<MigrationTracker>(t => new[] { t.IAM, t.Email }.Where(s => s != null).All(s => s!.IsCompleted));
        }

        private static MigrationTracker Tracker(ServiceMigrationStatus iam, ServiceMigrationStatus email, string createdBy = "starter") => new()
        {
            ItemId = "tracker-1",
            ProjectKey = "source",
            TargetedProjectKey = "target",
            TenantGroupId = "grp",
            CreatedBy = createdBy,
            IAM = iam,
            Email = email
        };

        private static MigrationCompletionEvent Event(string service, bool success) =>
            new() { TrackerId = "tracker-1", ServiceName = service, IsSuccess = success };

        [Fact]
        public async Task The_last_report_with_a_failure_tells_the_user_who_started_it_in_the_root_tenant()
        {
            // The failing service reported without a message: the event itself still counts as a failure.
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = true }, new ServiceMigrationStatus { IsCompleted = false }));

            await Consumer().Consume(Event("Email", success: false));

            var sent = _sender.Single(BuiltInNotificationNames.DataMigrationFailed);
            RecordingSender.Recipients(sent).Should().Equal("starter");
            sent.TenantId.Should().Be("root-tenant");
            sent.IsSuccess.Should().BeFalse();
            sent.Description.Should().Be("1 of 2 services failed: Email");
            sent.Ids["trackerId"].Should().Be("tracker-1");
            _service.Verify(s => s.NotifyDataMigrationEvent(It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never,
                "the existing success push is unchanged: still only when everything succeeded");
            _service.Verify(s => s.NotifyServiceDataMigrationProgress(false, "source", "target"), Times.Once);
        }

        [Fact]
        public async Task A_success_after_an_earlier_failure_also_ends_the_migration_with_failures()
        {
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = true }, new ServiceMigrationStatus { IsCompleted = false, ErrorMessage = "x" }));
            _service.Setup(s => s.AreAllServicesCompleted(It.IsAny<MigrationTracker>())).Returns(false);

            await Consumer().Consume(Event("IAM", success: true));

            _sender.Single(BuiltInNotificationNames.DataMigrationFailed).Description.Should().EndWith("Email");
        }

        [Fact]
        public async Task Nothing_is_sent_while_another_service_has_not_reported()
        {
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = false }, new ServiceMigrationStatus { IsCompleted = false }));

            await Consumer().Consume(Event("Email", success: false));

            _sender.Sent.Should().BeEmpty();
        }

        [Fact]
        public async Task Nothing_is_sent_when_every_service_succeeded()
        {
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = true }, new ServiceMigrationStatus { IsCompleted = true }));

            await Consumer().Consume(Event("Email", success: true));

            _sender.Sent.Should().BeEmpty();
            _service.Verify(s => s.NotifyDataMigrationEvent(true, "source", "target"), Times.Once);
        }

        [Fact]
        public async Task Nothing_is_sent_when_the_status_update_did_not_apply()
        {
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = true }, new ServiceMigrationStatus { IsCompleted = false }), updated: false);

            await Consumer().Consume(Event("Email", success: false));

            _sender.Sent.Should().BeEmpty();
        }

        [Fact]
        public async Task A_system_started_migration_has_no_recipient()
        {
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = true }, new ServiceMigrationStatus { IsCompleted = false }, createdBy: "system"));

            await Consumer().Consume(Event("Email", success: false));

            RecordingSender.Recipients(_sender.Sent.Single()).Should().BeEmpty();
        }

        [Fact]
        public async Task A_failing_notifier_does_not_fail_the_consumer()
        {
            Given(Tracker(new ServiceMigrationStatus { IsCompleted = true }, new ServiceMigrationStatus { IsCompleted = false }));
            var consumer = new MigrationCompletionConsumer(_repo.Object, NullLogger<MigrationCompletionConsumer>.Instance, _service.Object,
                FailingNotifier.Sender(), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["RootTenantId"] = "t" }).Build());

            var act = () => consumer.Consume(Event("Email", success: false));

            await act.Should().NotThrowAsync();
        }
    }

    // ── os-lmt-restore-progress ─────────────────────────────────────────────────────────────

    public class RestoreProgressNotificationTests : IDisposable
    {
        private readonly Mock<ILogTraceRestoreRepository> _restoreRepository = new();
        private readonly Mock<ILmtArchiveRestoreConfigurationRepository> _configRepository = new();
        private readonly Mock<IRestoreUserRepository> _userRepository = new();
        private readonly RecordingSender _sender = new();

        public RestoreProgressNotificationTests()
        {
            _configRepository
                .Setup(r => r.GetLmtArchiveRestoreConfigurationsAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new LmtArchiveRestoreConfigurations
                {
                    HotDataRetentionPeriodInDays = 30,
                    ColdToArchiveLifeCycleInDays = 90,
                    MaxRestoreRangeInDays = 7,
                    RetentionDay = 3
                });
        }

        public void Dispose()
        {
            BlocksContext.ClearContext();
            GC.SuppressFinalize(this);
        }

        private LogTraceRestoreService ColdService() => new(
            Mock.Of<ILogger<LogTraceRestoreService>>(), _restoreRepository.Object, Mock.Of<IMessageClient>(),
            Mock.Of<ILogTraceRestoreResultRepository>(), Mock.Of<ILogTraceRestoreParquetReader>(), Mock.Of<IBlobStorage>(),
            Mock.Of<IConfiguration>(), _configRepository.Object, new MailPreCheckDb().Object, Mock.Of<IHttpService>(),
            Mock.Of<ICryptoService>(), Mock.Of<ITenants>(), Mock.Of<IArchiveRestoreRepository>(), _userRepository.Object,
            new PassThroughOsDataAccess(), _sender);

        private ArchiveRestoreService ArchiveService() => new(
            Mock.Of<ILogger<ArchiveRestoreService>>(), Mock.Of<IBlobStorage>(), Mock.Of<IArchiveRestoreRepository>(),
            _restoreRepository.Object, _configRepository.Object, Mock.Of<IMessageClient>(), ColdService(), _userRepository.Object, _sender);

        private static DateTime DaysAgo(int days) => DateTime.UtcNow.Date.AddDays(-days);

        [Fact]
        public async Task A_cold_restore_request_tells_the_requester_it_was_accepted()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "requester", originalTenantId: "portal");

            var response = await ColdService().StartRestoreAsync(new StartColdRestoreRequest { ServiceName = "svc", StartDate = DaysAgo(50), EndDate = DaysAgo(48) });

            var sent = _sender.Single(BuiltInNotificationNames.LmtRestoreProgress);
            sent.Event.Should().Be("restore-accepted");
            sent.Ids["requestId"].Should().Be(response.RequestId);
            sent.Ids["sourceType"].Should().Be("Cold");
            sent.TenantId.Should().Be("portal");
            RecordingSender.Recipients(sent).Should().Equal("requester");
        }

        [Fact]
        public async Task An_archive_restore_request_tells_the_requester_it_was_accepted()
        {
            using var _ = new BlocksTestContext(tenantId: "project-1", userId: "requester");

            await ArchiveService().StartArchiveRestoreAsync(new StartArchiveRestoreRequest { ServiceName = "svc", StartDate = DaysAgo(200), EndDate = DaysAgo(198) });

            _sender.Single(BuiltInNotificationNames.LmtRestoreProgress).Ids["sourceType"].Should().Be("Archive");
        }

        [Fact]
        public async Task A_refused_restore_request_sends_nothing()
        {
            using var _ = new BlocksTestContext(userId: "requester");

            var act = () => ColdService().StartRestoreAsync(new StartColdRestoreRequest { ServiceName = "svc", StartDate = DaysAgo(2), EndDate = DaysAgo(1) });

            await act.Should().ThrowAsync<ArgumentException>();
            _sender.Sent.Should().BeEmpty();
        }

        private void GivenCompletingRequest()
        {
            _restoreRepository.Setup(r => r.GetRequestByIdAsync("req-1", It.IsAny<CancellationToken>()))
                .ReturnsAsync(new RestoreRequestRecord
                {
                    RequestId = "req-1", TenantId = "tenant-from-record", Status = RestoreRequestStatus.InProgress,
                    UserId = "requester", SourceType = RestoreSourceType.Cold
                });
            _restoreRepository.Setup(r => r.GetFileProgressByRequestIdAsync("req-1", It.IsAny<CancellationToken>())).ReturnsAsync([]);
            _restoreRepository.Setup(r => r.TryCompleteRequestAsync("req-1", It.IsAny<RestoreRequestStatus>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
        }

        [Fact]
        public async Task Completion_tells_the_requester_the_new_expiry_in_the_records_tenant()
        {
            BlocksContext.SetContext(null);
            GivenCompletingRequest();

            await ColdService().UpdateFileRequestStatus("req-1");

            var sent = _sender.Single(BuiltInNotificationNames.LmtRestoreProgress);
            sent.Event.Should().Be("restore-retention-extended");
            sent.TenantId.Should().Be("tenant-from-record");
            DateTime.Parse(sent.Ids["expireAt"]!, null, System.Globalization.DateTimeStyles.RoundtripKind)
                .Should().BeCloseTo(DateTime.UtcNow.AddDays(3), TimeSpan.FromMinutes(1));
            RecordingSender.Recipients(sent).Should().Equal("requester");
        }

        [Fact]
        public async Task No_retention_notice_when_the_expiry_could_not_be_extended()
        {
            BlocksContext.SetContext(null);
            GivenCompletingRequest();
            _restoreRepository.Setup(r => r.ExtendRequestExpiryAsync("req-1", It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ThrowsAsync(new InvalidOperationException("db"));

            await ColdService().UpdateFileRequestStatus("req-1");

            _sender.Sent.Should().BeEmpty();
        }
    }
}
