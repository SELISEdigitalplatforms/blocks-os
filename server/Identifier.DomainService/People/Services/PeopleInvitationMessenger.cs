using Blocks.Genesis;
using Blocks.Genesis.Entities.Iam;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DomainService.People
{
    /// <summary>
    /// Facade over the invitation messaging: queue publishing + invitation configuration.
    /// Replaces 2 separate deps (S107) in PeopleService.
    /// </summary>
    public interface IPeopleInvitationMessenger
    {
        /// <summary>Asks IAM to create (or re-invite) the user; IAM replies on the identifier queue.</summary>
        Task SendInvitationRequestToIamAsync(CreateUserByEmailEvent command);

        /// <summary>Queues the invitation mail and returns the invitation code embedded in its link.</summary>
        Task<string> SendInvitationEmailAsync(User user, Tenant project);

        /// <summary>Seconds the invitation link stays valid, never longer than the activation key (negative once expired).</summary>
        int ResolveInvitationLifetimeSeconds(DateTime? keyExpiresAtUtc);
    }

    public class PeopleInvitationMessenger : IPeopleInvitationMessenger
    {
        private static class CacheConstants
        {
            /// <summary>Used when People:InvitationLifetimeInMinutes is unset. Matches IAM's own default activation lifetime.</summary>
            public const int DefaultInvitationLifetimeInMinutes = 60 * 24;
        }

        private readonly ILogger<PeopleInvitationMessenger> _logger;
        private readonly IMessageClient _messageClient;
        private readonly IConfiguration _configuration;

        public PeopleInvitationMessenger(
            ILogger<PeopleInvitationMessenger> logger,
            IMessageClient messageClient,
            IConfiguration configuration)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _messageClient = messageClient ?? throw new ArgumentNullException(nameof(messageClient));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        }

        public async Task SendInvitationRequestToIamAsync(CreateUserByEmailEvent command)
        {
            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<CreateUserByEmailEvent>
                {
                    ConsumerName = IdentifierConstants.IamQueue,
                    Payload = command
                }
            );
        }

        /// <summary>
        /// How long the invitation link stays valid. IAM owns the activation key's lifetime, so when the mail
        /// carries a key we never outlive it; otherwise the link is ours alone and takes the configured lifetime.
        /// </summary>
        public int ResolveInvitationLifetimeSeconds(DateTime? keyExpiresAtUtc)
        {
            var configuredMinutes = int.TryParse(_configuration["InvitationLifetimeInMinutes"], out var minutes) && minutes > 0
                ? minutes
                : CacheConstants.DefaultInvitationLifetimeInMinutes;

            var configuredSeconds = configuredMinutes * 60;

            if (!keyExpiresAtUtc.HasValue) return configuredSeconds;

            var keyLifetimeSeconds = (int)(keyExpiresAtUtc.Value - DateTime.UtcNow).TotalSeconds;

            return Math.Min(configuredSeconds, keyLifetimeSeconds);
        }

        public async Task<string> SendInvitationEmailAsync(User user, Tenant project)
        {
            var invitationCode = Guid.NewGuid().ToString("n");
            var invitationLink = GenerateInvitationLink(invitationCode);
            var sendMailCommand = CreateSendMailCommand(user, project, invitationLink);

            await _messageClient.SendToConsumerAsync(
                new ConsumerMessage<SendMail>
                {
                    ConsumerName = IdentifierConstants.MailQueue,
                    Payload = sendMailCommand
                }
            );

            _logger.LogInformation("Invitation email queued for {Email}", user.Email);
            return invitationCode;
        }

        // The code redeems an invitation and, for an account that was never activated, yields the key that sets its
        // password. It is a bearer credential: never write it, or the link containing it, to the logs.
        private string GenerateInvitationLink(string code)
        {
            var blocksAppHost = _configuration["FrontendRuntime:BLOCKS_OS_URL"];
            if (string.IsNullOrWhiteSpace(blocksAppHost))
            {
                _logger.LogWarning("BlocksAppHost configuration is missing");
                blocksAppHost = "https://app.blocks.com";
            }

            return $"{blocksAppHost}/invitation?code={code}";
        }

        private SendMail CreateSendMailCommand(User user, Tenant project, string invitationLink)
        {
            var displayName = string.IsNullOrWhiteSpace(user.FirstName)
                ? user.Email
                : $"{user.FirstName} {user.LastName}".Trim();

            var projectName = project.Name;

            return new SendMail
            {
                Cc = Array.Empty<string>(),
                Bcc = Array.Empty<string>(),
                BodyDataContext = new Dictionary<string, string>
                {
                    { "ProjectInvitationLink", invitationLink },
                    { "DisplayName", displayName },
                    { "ProjectName", projectName }
                },
                Language = "en-US",
                Purpose = IdentifierConstants.ProjectPeopleInvitationMailPurpose,
                To = new[] { user.Email.ToLowerInvariant() }
            };
        }
    }
}
