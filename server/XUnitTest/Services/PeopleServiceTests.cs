using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.People;
using DomainService.Projects;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using XUnitTest.TestSupport;

namespace XUnitTest.Services
{
    public class PeopleServiceTests
    {
        private readonly Mock<ILogger<PeopleService>> _logger = new();
        private readonly Mock<IPeopleRepository> _peopleRepo = new();
        private readonly Mock<IMessageClient> _messageClient = new();
        private readonly Mock<ICacheClient> _cache = new();
        private readonly Mock<IProjectRepository> _projectRepo = new();
        private readonly Mock<ITenants> _tenants = new();
        private readonly IConfiguration _configuration;

        public PeopleServiceTests()
        {
            _configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    { "FrontendRuntime:BLOCKS_OS_URL", "https://console.blocks.dev" }
                })
                .Build();
        }

        private PeopleService Service() => new(
            _logger.Object, _peopleRepo.Object, _messageClient.Object,
            _configuration, _cache.Object, _projectRepo.Object, _tenants.Object);

        // ---------- GetPeoplesAsync ----------

        [Fact]
        public async Task GetPeoplesAsync_EmptyGroupId_ReturnsError()
        {
            var response = await Service().GetPeoplesAsync(new GetPeoplesRequest { ProjectGroupId = "" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("empty_group_id");
        }

        [Fact]
        public async Task GetPeoplesAsync_NoSharedProjects_ReturnsError()
        {
            _projectRepo.Setup(r => r.GetProjectPeoplesAsync("grp")).ReturnsAsync(new List<Project>());

            var response = await Service().GetPeoplesAsync(new GetPeoplesRequest { ProjectGroupId = "grp" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("no_projects");
        }

        [Fact]
        public async Task GetPeoplesAsync_Success_GroupsByPeople()
        {
            _projectRepo.Setup(r => r.GetProjectPeoplesAsync("grp"))
                        .ReturnsAsync(new List<Project> { new() { TenantId = "t1" } });

            var person = new PeopleDetails { Email = "a@x.com", UserId = "u1" };
            var peoples = new List<GetProjectPeople>
            {
                new() { ItemId = "p1", TenantId = "t1", peopleDetails = person, Enviroment = "dev" },
                new() { ItemId = "p2", TenantId = "t2", peopleDetails = person, Enviroment = "test" }
            };
            _peopleRepo.Setup(r => r.GetPeoplesAsync(It.IsAny<GetPeoplesRequest>()))
                       .ReturnsAsync((peoples, 2L, 1L, true));

            var response = await Service().GetPeoplesAsync(new GetPeoplesRequest { ProjectGroupId = "grp" });

            response.IsSuccess.Should().BeTrue();
            response.IsOwner.Should().BeTrue();
            response.Peoples.Should().ContainSingle();
            response.Peoples[0].SharedEnviroments.Should().HaveCount(2);
        }

        // ---------- InvitePeoplesAsync ----------

        [Fact]
        public async Task InvitePeoplesAsync_EmptyGroupId_ReturnsError()
        {
            var response = await Service().InvitePeoplesAsync(new InviteRequest { GroupId = "" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_group_id");
        }

        [Fact]
        public async Task InvitePeoplesAsync_NoTenants_ReturnsError()
        {
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string>());

            var response = await Service().InvitePeoplesAsync(new InviteRequest { GroupId = "grp" });

            response.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task InvitePeoplesAsync_NotOwner_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(false);

            var response = await Service().InvitePeoplesAsync(new InviteRequest { GroupId = "grp" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("own_project");
        }

        [Fact]
        public async Task InvitePeoplesAsync_ExistingUser_InsertsAndSendsInvitation()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { ItemId = "u2", Email = "invitee@x.com", FirstName = "Inv", Active = true, IsVerified = true } });
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u2", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople>());
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1"))
                       .ReturnsAsync(NewTenant());
            _peopleRepo.Setup(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>())).ReturnsAsync(true);
            _cache.Setup(c => c.AddStringValueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

            var request = new InviteRequest
            {
                GroupId = "grp",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "invitee@x.com", new List<EnviromentDetails> { new() { TenantId = "t1", Roles = new List<string> { "member" } } } }
                }
            };

            var response = await Service().InvitePeoplesAsync(request);

            response.IsSuccess.Should().BeTrue();
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()), Times.Once);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DomainService.Dtos.SendMail>>()), Times.Once);
        }

        [Fact]
        public async Task InvitePeoplesAsync_NewUser_SendsUserCreateEvent()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>())).ReturnsAsync(new List<User>());

            var request = new InviteRequest
            {
                GroupId = "grp",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "new@x.com", new List<EnviromentDetails> { new() { TenantId = "t1" } } }
                }
            };

            var response = await Service().InvitePeoplesAsync(request);

            response.IsSuccess.Should().BeTrue();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<CreateUserByEmailEvent>>()), Times.Once);
        }

        [Fact]
        public async Task InvitePeoplesAsync_NewUserWithRoles_PersistsRolesForAsyncPath()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>())).ReturnsAsync(new List<User>());
            _cache.Setup(c => c.AddStringValueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

            var request = new InviteRequest
            {
                GroupId = "grp",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "new@x.com", new List<EnviromentDetails> { new() { TenantId = "t1", Roles = new List<string> { "admin" } } } }
                }
            };

            var response = await Service().InvitePeoplesAsync(request);

            response.IsSuccess.Should().BeTrue();
            // The roles are cached under the invited address so the IAM post-event handler can re-apply them.
            _cache.Verify(c => c.AddStringValueAsync(
                "invitation-roles:new@x.com",
                It.Is<string>(v => v.Contains("admin") && v.Contains("t1")),
                It.IsAny<long>()), Times.Once);
        }

        // ---------- RemoveAccessFromProjectAsync ----------

        [Fact]
        public async Task RemoveAccess_InvalidRequest_ReturnsError()
        {
            var response = await Service().RemoveAccessFromProjectAsync(new RemoveAccessRequest
            {
                GroupId = "grp",
                Email = "",
                TenantIds = new List<string>()
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_request");
        }

        [Fact]
        public async Task RemoveAccess_Success_RemovesPeople()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { Email = "user@x.com" } });
            _peopleRepo.Setup(r => r.RemovePeoplesAsync("user@x.com", It.IsAny<List<string>>())).ReturnsAsync(true);

            var response = await Service().RemoveAccessFromProjectAsync(new RemoveAccessRequest
            {
                GroupId = "grp",
                Email = "user@x.com",
                TenantIds = new List<string> { "t1" }
            });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task RemoveAccess_UserNotFound_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>())).ReturnsAsync(new List<User>());

            var response = await Service().RemoveAccessFromProjectAsync(new RemoveAccessRequest
            {
                GroupId = "grp",
                Email = "user@x.com",
                TenantIds = new List<string> { "t1" }
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("user_not_found");
        }

        // ---------- ConfirmInvitationAsync ----------

        [Fact]
        public async Task ConfirmInvitation_EmptyCode_ReturnsError()
        {
            var response = await Service().ConfirmInvitationAsync(new ConfirmInvitationRequest { Code = "" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_code");
        }

        [Fact]
        public async Task ConfirmInvitation_CodeExpired_ReturnsError()
        {
            _cache.Setup(c => c.GetStringValueAsync("code1")).ReturnsAsync((string?)null);

            var response = await Service().ConfirmInvitationAsync(new ConfirmInvitationRequest { Code = "code1" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("code_expire");
        }

        [Fact]
        public async Task ConfirmInvitation_Valid_UpdatesPeopleAndClearsCache()
        {
            var cached = JsonSerializer.Serialize(new CacheProjectPeopleInvitation
            {
                ProjectPeopleIds = "p1;p2",
                UserActivationKey = "act-1"
            });
            _cache.Setup(c => c.GetStringValueAsync("code1")).ReturnsAsync(cached);
            _peopleRepo.Setup(r => r.UpdateProjectPeoples(It.IsAny<List<string>>())).ReturnsAsync(true);
            _cache.Setup(c => c.RemoveKeyAsync("code1")).ReturnsAsync(true);

            var response = await Service().ConfirmInvitationAsync(new ConfirmInvitationRequest { Code = "code1" });

            response.IsSuccess.Should().BeTrue();
            response.ActivationKey.Should().Be("act-1");
            _peopleRepo.Verify(r => r.UpdateProjectPeoples(It.Is<List<string>>(l => l.Count == 2)), Times.Once);
        }

        // ---------- SendProjectInvitationToNewUser ----------

        [Fact]
        public async Task SendProjectInvitationToNewUser_InvalidEvent_ReturnsFalse()
        {
            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "",
                TenantId = ""
            });

            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_Success_ReturnsTrue()
        {
            using var _ = new BlocksTestContext();
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync(NewTenant());
            _peopleRepo.Setup(r => r.GetUserByIdAsync("u1")).ReturnsAsync(new User { ItemId = "u1", Email = "u@x.com" });
            _peopleRepo.Setup(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>())).ReturnsAsync(true);
            _cache.Setup(c => c.AddStringValueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1",
                Key = "k1",
                EventType = DomainService.Shared.IdentifierConstants.ProjectPeopleInvitationMailPurpose
            });

            result.Should().BeTrue();
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DomainService.Dtos.SendMail>>()), Times.Once);
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_AppliesCachedRolesToCreatedRows()
        {
            using var _ = new BlocksTestContext();
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync(NewTenant());
            _peopleRepo.Setup(r => r.GetUserByIdAsync("u1")).ReturnsAsync(new User { ItemId = "u1", Email = "u@x.com" });
            // Roles were persisted by the invite path, keyed by the invited address.
            _cache.Setup(c => c.GetStringValueAsync("invitation-roles:u@x.com"))
                  .ReturnsAsync("{\"t1\":[\"admin\",\"member\"]}");
            _cache.Setup(c => c.AddStringValueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

            List<ProjectPeople>? inserted = null;
            _peopleRepo.Setup(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()))
                       .Callback<List<ProjectPeople>>(l => inserted = l)
                       .ReturnsAsync(true);

            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1",
                Key = "k1",
                EventType = DomainService.Shared.IdentifierConstants.ProjectPeopleInvitationMailPurpose
            });

            result.Should().BeTrue();
            inserted.Should().ContainSingle();
            inserted![0].Roles.Should().BeEquivalentTo(new[] { "admin", "member" });
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_NullEvent_ReturnsFalse()
        {
            var result = await Service().SendProjectInvitationToNewUser(null!);

            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_UnrelatedEventType_ReturnsFalse()
        {
            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1",
                EventType = "some-other-purpose"
            });

            result.Should().BeFalse();
            _peopleRepo.Verify(r => r.GetProjectByIdAsync(It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_AllEnvironmentsAlreadyPresent_SkipsAndReturnsTrue()
        {
            using var _ = new BlocksTestContext();
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync(NewTenant());
            _peopleRepo.Setup(r => r.GetUserByIdAsync("u1")).ReturnsAsync(new User { ItemId = "u1", Email = "u@x.com" });
            // The person already has a confirmed row for the only requested tenant,
            // and this is a redelivery (no ForceInvitation), so nothing is created.
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u1", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople>
                       {
                           new() { ItemId = "pp1", TenantId = "t1", UserId = "u1", IsInvitationConfirmed = true }
                       });

            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1",
                Key = "k1",
                EventType = DomainService.Shared.IdentifierConstants.ProjectPeopleInvitationMailPurpose,
                ForceInvitation = false
            });

            result.Should().BeTrue();
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()), Times.Never);
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_IamReportedFailure_ReturnsFalseAndDoesNotInsert()
        {
            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1",
                EventType = DomainService.Shared.IdentifierConstants.ProjectPeopleInvitationMailPurpose,
                Success = false,
                FailureReason = "Signup Policy Validation Error"
            });

            result.Should().BeFalse();
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()), Times.Never);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DomainService.Dtos.SendMail>>()), Times.Never);
        }

        // ---------- ResendInvitationAsync ----------

        [Fact]
        public async Task ResendInvitation_InvalidRequest_ReturnsError()
        {
            var response = await Service().ResendInvitationAsync(new ResendInvitationRequest { GroupId = "", Email = "" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_request");
        }

        [Fact]
        public async Task ResendInvitation_Success_ResendsInvitation()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { ItemId = "u1", Email = "user@x.com" } });
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u1", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople> { new() { ItemId = "p1", TenantId = "t1" } });
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync(NewTenant());
            _cache.Setup(c => c.AddStringValueAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<long>())).ReturnsAsync(true);

            var response = await Service().ResendInvitationAsync(new ResendInvitationRequest { GroupId = "grp", Email = "user@x.com" });

            response.IsSuccess.Should().BeTrue();
        }

        [Fact]
        public async Task ResendInvitation_NoInvitations_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { ItemId = "u1", Email = "user@x.com" } });
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u1", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople>());

            var response = await Service().ResendInvitationAsync(new ResendInvitationRequest { GroupId = "grp", Email = "user@x.com" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invitation_not_found");
        }

        // ---------- TransferOwnershipAsync ----------

        [Fact]
        public async Task TransferOwnership_MissingGroupId_ReturnsError()
        {
            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest
            {
                TenantGroupId = "",
                TransferToUserEmail = "new@x.com"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("TenantGroupId");
        }

        [Fact]
        public async Task TransferOwnership_MissingEmail_ReturnsError()
        {
            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest
            {
                TenantGroupId = "grp",
                TransferToUserEmail = ""
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("TransferToUserEmail");
        }

        [Fact]
        public async Task TransferOwnership_UserNotFound_ReturnsError()
        {
            _peopleRepo.Setup(r => r.GetUserByEmailAsync("new@x.com")).ReturnsAsync((User?)null);

            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest
            {
                TenantGroupId = "grp",
                TransferToUserEmail = "new@x.com"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("TransferToUserEmail");
        }

        [Fact]
        public async Task TransferOwnership_NotOwner_ReturnsError()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _peopleRepo.Setup(r => r.GetUserByEmailAsync("new@x.com")).ReturnsAsync(new User { ItemId = "u2", Email = "new@x.com" });
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(false);

            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest
            {
                TenantGroupId = "grp",
                TransferToUserEmail = "new@x.com"
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("own_project");
        }

        [Fact]
        public async Task TransferOwnership_Success_TransfersAndCreatesMissingPeople()
        {
            using var _ = new BlocksTestContext(userId: "owner-id", userName: "owner@x.com");
            _peopleRepo.Setup(r => r.GetUserByEmailAsync("new@x.com")).ReturnsAsync(new User { ItemId = "u2", Email = "new@x.com" });
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("owner-id", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople> { new() { ItemId = "p1", TenantId = "t1" } });
            _peopleRepo.Setup(r => r.UpdateProjectPeopleOwnerShipAsync(It.IsAny<List<string>>(), It.IsAny<bool>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetProjectPeopleByTenantIdAndUserIdAsync("t1", "u2")).ReturnsAsync((ProjectPeople?)null);
            _peopleRepo.Setup(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>())).ReturnsAsync(true);
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(NewTenant());
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest
            {
                TenantGroupId = "grp",
                TransferToUserEmail = "new@x.com"
            });

            response.IsSuccess.Should().BeTrue();
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()), Times.Once);
        }

        // ---------- Additional branch coverage ----------

        [Fact]
        public async Task InvitePeoplesAsync_SkipsOwnEmailAndEmptyEnvironments()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);

            var request = new InviteRequest
            {
                GroupId = "grp",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "owner@x.com", new List<EnviromentDetails> { new() { TenantId = "t1" } } }, // own email -> skipped
                    { "someone@x.com", new List<EnviromentDetails>() }                             // empty env -> skipped
                }
            };

            var response = await Service().InvitePeoplesAsync(request);

            response.IsSuccess.Should().BeTrue();
            // Neither invitation should reach the user lookup.
            _peopleRepo.Verify(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()), Times.Never);
        }

        [Fact]
        public async Task InvitePeoplesAsync_UserAlreadyHasAccess_DoesNotInsert()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { ItemId = "u2", Email = "invitee@x.com" } });
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u2", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople> { new() { TenantId = "t1" } }); // already has t1

            var request = new InviteRequest
            {
                GroupId = "grp",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "invitee@x.com", new List<EnviromentDetails> { new() { TenantId = "t1" } } }
                }
            };

            var response = await Service().InvitePeoplesAsync(request);

            response.IsSuccess.Should().BeTrue();
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()), Times.Never);
        }

        [Fact]
        public async Task InvitePeoplesAsync_ExistingUserWithPriorAccess_InsertsWithoutFirstInvitationEmail()
        {
            using var _ = new BlocksTestContext(userName: "owner@x.com");
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1", "t2" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { ItemId = "u2", Email = "invitee@x.com" } });
            // Already an accepted member of t1, so this is not a first invitation; adding t2 should not send an email.
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u2", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople> { new() { TenantId = "t1", IsInvitationConfirmed = true } });
            _peopleRepo.Setup(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>())).ReturnsAsync(true);

            var request = new InviteRequest
            {
                GroupId = "grp",
                Invitations = new Dictionary<string, List<EnviromentDetails>>
                {
                    { "invitee@x.com", new List<EnviromentDetails> { new() { TenantId = "t2" } } }
                }
            };

            var response = await Service().InvitePeoplesAsync(request);

            response.IsSuccess.Should().BeTrue();
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.Is<List<ProjectPeople>>(l =>
                l.Count == 1 && l[0].IsInvitationConfirmed)), Times.Once);
            _messageClient.Verify(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<DomainService.Dtos.SendMail>>()), Times.Never);
        }

        [Fact]
        public async Task RemoveAccess_NoValidTenantKeys_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);

            var response = await Service().RemoveAccessFromProjectAsync(new RemoveAccessRequest
            {
                GroupId = "grp",
                Email = "user@x.com",
                TenantIds = new List<string> { "not-in-group" }
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_group_id");
        }

        [Fact]
        public async Task RemoveAccess_NotOwner_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(false);

            var response = await Service().RemoveAccessFromProjectAsync(new RemoveAccessRequest
            {
                GroupId = "grp",
                Email = "user@x.com",
                TenantIds = new List<string> { "t1" }
            });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("own_project");
        }

        [Fact]
        public async Task ConfirmInvitation_InvalidCachedData_ReturnsError()
        {
            _cache.Setup(c => c.GetStringValueAsync("code1")).ReturnsAsync("{\"ProjectPeopleIds\":\"\"}");

            var response = await Service().ConfirmInvitationAsync(new ConfirmInvitationRequest { Code = "code1" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_data");
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_NoTenantIds_ReturnsFalse()
        {
            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = ";;;"
            });

            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_ProjectNotFound_ReturnsFalse()
        {
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync((Tenant?)null);

            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1"
            });

            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendProjectInvitationToNewUser_UserNotFound_ReturnsFalse()
        {
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync(NewTenant());
            _peopleRepo.Setup(r => r.GetUserByIdAsync("u1")).ReturnsAsync((User?)null);

            var result = await Service().SendProjectInvitationToNewUser(new CreateUserByEmailPostEvent
            {
                UserId = "u1",
                TenantId = "t1"
            });

            result.Should().BeFalse();
        }

        [Fact]
        public async Task ResendInvitation_UserNotFound_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>())).ReturnsAsync(new List<User>());

            var response = await Service().ResendInvitationAsync(new ResendInvitationRequest { GroupId = "grp", Email = "user@x.com" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("user_not_found");
        }

        [Fact]
        public async Task ResendInvitation_NoTenants_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string>());

            var response = await Service().ResendInvitationAsync(new ResendInvitationRequest { GroupId = "grp", Email = "user@x.com" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("invalid_group_id");
        }

        [Fact]
        public async Task ResendInvitation_ProjectNotFound_ReturnsError()
        {
            using var _ = new BlocksTestContext();
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetUsersByEmailAsync(It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<User> { new() { ItemId = "u1", Email = "user@x.com", Active = true, IsVerified = true } });
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("u1", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople> { new() { ItemId = "p1", TenantId = "t1" } });
            _peopleRepo.Setup(r => r.GetProjectByIdAsync("t1")).ReturnsAsync((Tenant?)null);

            var response = await Service().ResendInvitationAsync(new ResendInvitationRequest { GroupId = "grp", Email = "user@x.com" });

            response.IsSuccess.Should().BeFalse();
            response.Errors.Should().ContainKey("project_not_found");
        }

        [Fact]
        public async Task TransferOwnership_ExistingTargetPeople_UpdatesOwnership()
        {
            using var _ = new BlocksTestContext(userId: "owner-id", userName: "owner@x.com");
            _peopleRepo.Setup(r => r.GetUserByEmailAsync("new@x.com")).ReturnsAsync(new User { ItemId = "u2", Email = "new@x.com" });
            _projectRepo.Setup(r => r.GetProjectIdsByGroupId("grp")).ReturnsAsync(new List<string> { "t1" });
            _peopleRepo.Setup(r => r.IsOwner(It.IsAny<string>(), It.IsAny<List<string>>())).ReturnsAsync(true);
            _peopleRepo.Setup(r => r.GetProjectPeoplesAsync("owner-id", It.IsAny<List<string>>()))
                       .ReturnsAsync(new List<ProjectPeople> { new() { ItemId = "p1", TenantId = "t1" } });
            _peopleRepo.Setup(r => r.UpdateProjectPeopleOwnerShipAsync(It.IsAny<List<string>>(), It.IsAny<bool>())).ReturnsAsync(true);
            // Target already has a ProjectPeople record for t1 -> goes into projectPeopleIds branch.
            _peopleRepo.Setup(r => r.GetProjectPeopleByTenantIdAndUserIdAsync("t1", "u2"))
                       .ReturnsAsync(new ProjectPeople { ItemId = "pp-existing", TenantId = "t1", UserId = "u2" });
            _tenants.Setup(t => t.GetTenantByID(It.IsAny<string>())).Returns(NewTenant());
            _tenants.Setup(t => t.UpdateTenantVersionAsync(It.IsAny<TenantCacheUpdateMessage>())).Returns(Task.CompletedTask);

            var response = await Service().TransferOwnershipAsync(new TransferOwnershipRequest
            {
                TenantGroupId = "grp",
                TransferToUserEmail = "new@x.com"
            });

            response.IsSuccess.Should().BeTrue();
            // Existing record ids are re-flagged as owners.
            _peopleRepo.Verify(r => r.UpdateProjectPeopleOwnerShipAsync(
                It.Is<List<string>>(l => l.Contains("pp-existing")), true), Times.Once);
            _peopleRepo.Verify(r => r.InsertPeoplesAsync(It.IsAny<List<ProjectPeople>>()), Times.Never);
        }

        private static Tenant NewTenant() => new()
        {
            DbConnectionString = "mongodb://x",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = System.DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
            TenantId = "t1",
            Name = "Proj",
            Applications = new List<Applications>()
        };
    }
}
