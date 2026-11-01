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
using Blocks.Genesis.Notifications;
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

    /// <summary>A real sender whose publisher always fails: proves an action survives a broken publisher end to end.</summary>
    internal static class FailingNotifier
    {
        public static BuiltInNotificationSender Sender()
        {
            var publisher = new Mock<INotificationPublisher>();
            publisher.Setup(p => p.Publish(It.IsAny<NotificationRequest>())).Throws(new InvalidOperationException("down"));
            return new BuiltInNotificationSender(publisher.Object, NullLogger<BuiltInNotificationSender>.Instance);
        }
    }

    // ── os-project-member-removed, os-project-ownership-transferred ─────────────────────────

    public class PeopleNotificationTests
    {
        private readonly Mock<IPeopleRepository> _peopleRepo = new();
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly RecordingSender _sender = new();

        private PeopleService Service(IBuiltInNotificationSender? sender = null) => new(
            Mock.Of<ILogger<PeopleService>>(), _peopleRepo.Object, Mock.Of<IPeopleInvitationMessenger>(),
            Mock.Of<ICacheClient>(), _projectRepo.Object, _tenants.Object,
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
        public async Task An_inactive_member_is_refused_and_nothing_is_written()
        {
            using var _ = new BlocksTestContext(userId: "owner");
            GivenMember();
            _peopleRepo.Setup(r => r.GetUserByIdAsync("member")).ReturnsAsync(new User
            {
                ItemId = "member", Email = "member@x.com", Active = false, IsVerified = true, Status = UserLifecycleStatus.Disabled
            });

            var response = await Service().SaveAccessPolicyAsync(new SaveAccessPolicyRequest { ProjectGroupId = "grp", UserId = "member" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey(UserAccountStatus.InactiveErrorCode);
            _sender.Sent.Should().BeEmpty();
            _peopleRepo.Verify(r => r.UpdateAccessPoliciesAsync(It.IsAny<List<string>>(), It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task A_pending_invitee_can_still_be_given_access()
        {
            using var _ = new BlocksTestContext(userId: "owner");
            GivenMember();
            _peopleRepo.Setup(r => r.GetUserByIdAsync("member")).ReturnsAsync(new User { ItemId = "member", Active = false, IsVerified = false });

            var response = await Service().SaveAccessPolicyAsync(new SaveAccessPolicyRequest { ProjectGroupId = "grp", UserId = "member" });

            response.IsSuccess.Should().BeTrue();
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
}
