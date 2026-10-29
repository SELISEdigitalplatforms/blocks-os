using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Blocks.Genesis;
using Blocks.Genesis.Entities.Iam;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.People;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace XUnitTest.Services
{
    public class PeopleInvitationMessengerTests
    {
        private readonly Mock<IMessageClient> _messageClient = new();

        private PeopleInvitationMessenger Messenger(Dictionary<string, string?>? config = null) => new(
            Mock.Of<ILogger<PeopleInvitationMessenger>>(), _messageClient.Object,
            new ConfigurationBuilder().AddInMemoryCollection(config ?? new Dictionary<string, string?>()).Build());

        [Fact]
        public void Lifetime_Unset_DefaultsToOneDay()
            => Messenger().ResolveInvitationLifetimeSeconds(null).Should().Be(24 * 60 * 60);

        [Fact]
        public void Lifetime_Configured_UsesConfiguredMinutes()
            => Messenger(new() { ["InvitationLifetimeInMinutes"] = "30" })
                .ResolveInvitationLifetimeSeconds(null).Should().Be(30 * 60);

        [Fact]
        public void Lifetime_InvalidConfig_FallsBackToDefault()
            => Messenger(new() { ["InvitationLifetimeInMinutes"] = "-5" })
                .ResolveInvitationLifetimeSeconds(null).Should().Be(24 * 60 * 60);

        [Fact]
        public void Lifetime_NeverOutlivesActivationKey()
        {
            var seconds = Messenger().ResolveInvitationLifetimeSeconds(DateTime.UtcNow.AddMinutes(10));

            seconds.Should().BeInRange(9 * 60, 10 * 60);
        }

        [Fact]
        public void Lifetime_ExpiredKey_IsNotPositive()
            => Messenger().ResolveInvitationLifetimeSeconds(DateTime.UtcNow.AddMinutes(-1)).Should().BeLessThanOrEqualTo(0);

        [Fact]
        public async Task SendInvitationEmail_UsesConfiguredHost_AndQueuesToMailQueue()
        {
            ConsumerMessage<SendMail>? sent = null;
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<SendMail>>()))
                .Callback<ConsumerMessage<SendMail>>(c => sent = c).Returns(Task.CompletedTask);

            var code = await Messenger(new() { ["FrontendRuntime:BLOCKS_OS_URL"] = "https://console.blocks.dev" })
                .SendInvitationEmailAsync(new User { Email = "A@X.com", FirstName = "Ann", LastName = "Lee" }, NewTenant());

            sent.Should().NotBeNull();
            sent!.ConsumerName.Should().Be(DomainService.Shared.IdentifierConstants.MailQueue);
            sent.Payload.To.Should().Equal("a@x.com");
            sent.Payload.BodyDataContext["ProjectInvitationLink"].Should().Be($"https://console.blocks.dev/invitation?code={code}");
            sent.Payload.BodyDataContext["DisplayName"].Should().Be("Ann Lee");
        }

        [Fact]
        public async Task SendInvitationEmail_HostMissing_FallsBackToDefaultHost()
        {
            ConsumerMessage<SendMail>? sent = null;
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<SendMail>>()))
                .Callback<ConsumerMessage<SendMail>>(c => sent = c).Returns(Task.CompletedTask);

            var code = await Messenger().SendInvitationEmailAsync(new User { Email = "a@x.com" }, NewTenant());

            sent!.Payload.BodyDataContext["ProjectInvitationLink"].Should().Be($"https://app.blocks.com/invitation?code={code}");
            sent.Payload.BodyDataContext["DisplayName"].Should().Be("a@x.com");
        }

        [Fact]
        public async Task SendInvitationRequestToIam_QueuesToIamQueue()
        {
            ConsumerMessage<CreateUserByEmailEvent>? sent = null;
            _messageClient.Setup(m => m.SendToConsumerAsync(It.IsAny<ConsumerMessage<CreateUserByEmailEvent>>()))
                .Callback<ConsumerMessage<CreateUserByEmailEvent>>(c => sent = c).Returns(Task.CompletedTask);
            var command = new CreateUserByEmailEvent { Email = "a@x.com" };

            await Messenger().SendInvitationRequestToIamAsync(command);

            sent!.ConsumerName.Should().Be(DomainService.Shared.IdentifierConstants.IamQueue);
            sent.Payload.Should().BeSameAs(command);
        }

        private static Tenant NewTenant() => new()
        {
            DbConnectionString = "mongodb://x",
            JwtTokenParameters = new JwtTokenParameters { IssueDate = DateTime.UtcNow, PrivateCertificatePassword = "pwd" },
            TenantId = "t1",
            Name = "Proj"
        };
    }
}
