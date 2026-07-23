using Blocks.Genesis;
using DomainService.Dtos;
using DomainService.Entities;
using DomainService.Projects;
using DomainService.Shared;
using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace DomainService.People
{
    public class PeopleService : IPeopleService
    {
        private static class CacheConstants
        {
            /// <summary>Used when People:InvitationLifetimeInMinutes is unset. Matches IAM's own default activation lifetime.</summary>
            public const int DefaultInvitationLifetimeInMinutes = 60 * 24;
        }

        private static class ErrorCodes
        {
            public const string EmptyGroupId = "empty_group_id";
            public const string InvalidGroupId = "invalid_group_id";
            public const string InvalidEnvironment = "invalid_environment";
            public const string UserNotFound = "user_not_found";
            public const string CodeExpired = "code_expire";
            public const string AlreadySignedUp = "already_signup";
            public const string InvitationNotFound = "invitation_not_found";
        }

        private readonly ILogger<PeopleService> _logger;
        private readonly IPeopleRepository _peopleRepository;
        private readonly IMessageClient _messageClient;
        private readonly IConfiguration _configuration;
        private readonly ICacheClient _cacheClient;
        private readonly IProjectRepository _projectRepository;
        private readonly ITenants _tenants;

        public PeopleService(
            ILogger<PeopleService> logger,
            IPeopleRepository peopleRepository,
            IMessageClient messageClient,
            IConfiguration configuration,
            ICacheClient cacheClient,
            IProjectRepository projectRepository,
            ITenants tenants)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _peopleRepository = peopleRepository ?? throw new ArgumentNullException(nameof(peopleRepository));
            _messageClient = messageClient ?? throw new ArgumentNullException(nameof(messageClient));
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _cacheClient = cacheClient ?? throw new ArgumentNullException(nameof(cacheClient));
            _projectRepository = projectRepository;
            _tenants = tenants;
        }

        public async Task<GetPeoplesResponse> GetPeoplesAsync(GetPeoplesRequest request)
        {
            _logger.LogInformation("GetPeoplesAsync started for GroupId: {GroupId}", request?.ProjectGroupId);

            if (request == null || string.IsNullOrWhiteSpace(request.ProjectGroupId))
            {
                _logger.LogWarning("GetPeoplesAsync called with empty or null ProjectGroupId");
                return new GetPeoplesResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { ErrorCodes.EmptyGroupId, "Project groupId is required" }
                    }
                };
            }

            var sharedEnvironments = await _projectRepository.GetProjectPeoplesAsync(request.ProjectGroupId);
            if (sharedEnvironments == null || sharedEnvironments.Count == 0)
            {
                _logger.LogError("No projects are shared with user");
                return new GetPeoplesResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                        {
                            { "no_projects", "No projects are shared with user" }
                        }
                };
            }

            try
            {
                var result = await _peopleRepository.GetPeoplesAsync(request);

                var peoples = result.peoples
                    .GroupBy(p => p.peopleDetails)
                    .Select(g => new GetPeoples
                    {
                        peopleDetails = g.Key,
                        SharedEnviroments = g.Select(p => new SharedEnviroment
                        {
                            ItemId = p.ItemId,
                            TenantId = p.TenantId,
                            IsInvitationSent = p.IsInvitationSent,
                            IsInvitationConfirmed = p.IsInvitationConfirmed,
                            IsCreator = p.IsCreator,
                            Enviroment = p.Enviroment
                        }).ToList()
                    })
                    .ToList();

                _logger.LogInformation("GetPeoplesAsync completed successfully. Total count: {TotalCount}", result.totalCount);

                return new GetPeoplesResponse
                {
                    IsSuccess = true,
                    Peoples = peoples,
                    IsOwner = result.isOwner,
                    TotalCount = result.totalCount,
                    PeoplesTotalCount = result.peoplesTotalCount
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting peoples for GroupId: {GroupId}", request.ProjectGroupId);
                throw;
            }
        }

        public async Task<InviteResponse> InvitePeoplesAsync(InviteRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.GroupId))
            {
                _logger.LogWarning("InvitePeoplesAsync called with invalid request");
                return new InviteResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { ErrorCodes.InvalidGroupId, "GroupId is required" }
                    }
                };
            }

            _logger.LogInformation("InvitePeoplesAsync started for GroupId: {GroupId}", request.GroupId);

            try
            {
                var tenants = await _projectRepository.GetProjectIdsByGroupId(request.GroupId);

                if (tenants == null || tenants.Count == 0)
                {
                    _logger.LogWarning("No tenants found for GroupId: {GroupId}", request.GroupId);
                    return new InviteResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.InvalidGroupId, "The given groupId is invalid" }
                        }
                    };
                }

                var userId = BlocksContext.GetContext()?.UserId ?? string.Empty;

                if (!await _peopleRepository.IsOwner(userId, tenants))
                {
                    return new InviteResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { "own_project", "You are not allowed to share this projects" }
                        }
                    };
                }

                // IAM stores every email lowercased, so an address typed with different casing would otherwise
                // miss the lookup below and have a duplicate account created for it.
                request.Invitations = NormalizeInvitations(request.Invitations);

                // Ownership was checked against the group, so access may only be granted within the group.
                var foreignTenantIds = request.Invitations.Values
                    .Where(envDetails => envDetails != null)
                    .SelectMany(envDetails => envDetails)
                    .Select(env => env.TenantId)
                    .Where(tenantId => !tenants.Contains(tenantId))
                    .Distinct()
                    .ToList();

                if (foreignTenantIds.Count > 0)
                {
                    _logger.LogWarning(
                        "InvitePeoplesAsync rejected: environments {TenantIds} do not belong to GroupId: {GroupId}",
                        string.Join(", ", foreignTenantIds), request.GroupId);

                    return new InviteResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.InvalidEnvironment, "One or more environments do not belong to the given groupId" }
                        }
                    };
                }

                var callerEmail = NormalizeEmail(BlocksContext.GetContext()?.UserName);
                var results = new Dictionary<string, string>();

                foreach (var (email, envDetails) in request.Invitations)
                {
                    if (email == callerEmail)
                    {
                        _logger.LogWarning("Skipping self invitation for email: {Email}", email);
                        results[email] = InvitationOutcomes.SkippedSelf;
                        continue;
                    }

                    if (envDetails == null || envDetails.Count == 0)
                    {
                        _logger.LogWarning("No valid project keys found for email: {Email}", email);
                        results[email] = InvitationOutcomes.SkippedNoEnvironments;
                        continue;
                    }

                    results[email] = await ProcessInvitationForEmail(email, envDetails, tenants);
                }

                _logger.LogInformation("InvitePeoplesAsync completed for GroupId: {GroupId}. Outcomes: {Outcomes}",
                    request.GroupId, string.Join(", ", results.Select(r => $"{r.Key}={r.Value}")));

                return new InviteResponse { IsSuccess = true, Results = results };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while inviting peoples for GroupId: {GroupId}", request.GroupId);
                throw;
            }
        }

        private static string NormalizeEmail(string? email) => email?.Trim().ToLowerInvariant() ?? string.Empty;

        /// <summary>
        /// Lowercases the addresses and merges any that differed only by casing, so a person cannot be
        /// invited twice in one request under two spellings of the same address.
        /// </summary>
        private static Dictionary<string, List<EnviromentDetails>> NormalizeInvitations(Dictionary<string, List<EnviromentDetails>> invitations)
        {
            var normalized = new Dictionary<string, List<EnviromentDetails>>();

            foreach (var (email, envDetails) in invitations)
            {
                var normalizedEmail = NormalizeEmail(email);

                if (string.IsNullOrWhiteSpace(normalizedEmail)) continue;

                if (!normalized.TryGetValue(normalizedEmail, out var merged))
                {
                    normalized[normalizedEmail] = envDetails ?? [];
                    continue;
                }

                foreach (var env in envDetails ?? [])
                {
                    if (!merged.Any(e => e.TenantId == env.TenantId)) merged.Add(env);
                }
            }

            return normalized;
        }

        /// <summary>
        /// An account that cannot sign in yet needs an activation key in its invitation mail, and only IAM can
        /// mint one. True for someone with no account at all, and for one that was never activated.
        /// </summary>
        private static bool NeedsActivationKey(User? user) => user == null || !user.Active || !user.IsVerified;

        private async Task<string> ProcessInvitationForEmail(string email, List<EnviromentDetails> enviromentDetails, List<string> tenants)
        {
            var existingUsers = await _peopleRepository.GetUsersByEmailAsync(new List<string> { email });
            var user = existingUsers?.FirstOrDefault(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase));

            // No account yet: IAM has to create it before any project people row may reference it.
            if (user == null)
            {
                _logger.LogInformation("User not found for email: {Email}. Creating new user.", email);
                await RequestInvitationFromIam(email, enviromentDetails, forceInvitation: false);
                return InvitationOutcomes.UserCreationRequested;
            }

            var existingPeople = await _peopleRepository.GetProjectPeoplesAsync(user.ItemId, tenants) ?? new List<ProjectPeople>();
            var existingTenantIds = existingPeople.Select(p => p.TenantId).ToList();
            var newEnviroments = enviromentDetails.Where(e => !existingTenantIds.Contains(e.TenantId)).ToList();

            if (newEnviroments.Count == 0)
            {
                _logger.LogInformation("User {Email} already has access to all requested projects", user.Email);
                return InvitationOutcomes.AlreadyHasAccess;
            }

            // Holding a row is not the same as having accepted it. Only someone who already accepted an
            // invitation into this group (or owns it) may be added to further environments without confirming.
            var hasAcceptedInvitation = existingPeople.Any(p => p.IsInvitationConfirmed || p.IsCreator);

            if (hasAcceptedInvitation)
            {
                await _peopleRepository.InsertPeoplesAsync(BuildProjectPeoples(user, newEnviroments, isInvitationConfirmed: true));
                _logger.LogInformation("Granted {Count} environments to already-accepted user: {Email}", newEnviroments.Count, user.Email);
                return InvitationOutcomes.AccessGranted;
            }

            // They have to accept, but cannot sign in yet, so the mail must carry an activation key from IAM.
            // IAM answers on the queue and the post-event handler creates the rows and sends the mail.
            if (NeedsActivationKey(user))
            {
                _logger.LogInformation("User {Email} is not activated; requesting an activation key from IAM", user.Email);
                await RequestInvitationFromIam(user.Email, newEnviroments, forceInvitation: false);
                return InvitationOutcomes.InvitationRequested;
            }

            // They have to accept and can already sign in: no key needed, so blocks-os owns the whole invitation.
            var projectPeoples = BuildProjectPeoples(user, newEnviroments, isInvitationConfirmed: false);

            await _peopleRepository.InsertPeoplesAsync(projectPeoples);
            _logger.LogInformation("Inserted {Count} project people records for email: {Email}", projectPeoples.Count, email);

            var project = await _peopleRepository.GetProjectByIdAsync(newEnviroments[0].TenantId);

            // One link confirms everything still pending for this person, not just the new rows,
            // so an earlier unaccepted invitation cannot be stranded.
            var projectPeopleIds = projectPeoples
                .Select(x => x.ItemId)
                .Concat(existingPeople.Where(p => !p.IsInvitationConfirmed).Select(p => p.ItemId))
                .ToList();

            var invitationSent = await ProcessInvitation(user, projectPeopleIds, project, string.Empty, null);

            return invitationSent ? InvitationOutcomes.Invited : InvitationOutcomes.InvitationNotSent;
        }

        private static List<ProjectPeople> BuildProjectPeoples(User user, List<EnviromentDetails> enviromentDetails, bool isInvitationConfirmed)
        {
            return enviromentDetails
                .Select(env => new ProjectPeople
                {
                    ItemId = Guid.NewGuid().ToString(),
                    TenantId = env.TenantId,
                    Email = user.Email,
                    IsInvitationSent = true,
                    IsInvitationConfirmed = isInvitationConfirmed,
                    UserId = user.ItemId,
                    Roles = env.Roles
                })
                .ToList();
        }

        private ProjectPeople CreateProjectPeople(User user, string tenantId, string email, List<string> roles)
        {
            return new ProjectPeople
            {
                ItemId = Guid.NewGuid().ToString(),
                TenantId = tenantId,
                Email = email,
                IsInvitationSent = true,
                UserId = user.ItemId,
                Roles = roles ?? []
            };
        }

        private static string InvitationRolesCacheKey(string email) => $"invitation-roles:{email.ToLowerInvariant()}";

        /// <summary>
        /// Persists the per-environment roles chosen at invite time so the asynchronous IAM path can set
        /// <see cref="ProjectPeople.Roles"/> the same way <see cref="BuildProjectPeoples"/> does on the sync path.
        /// The IAM round-trip carries only the tenant ids, not the roles, so blocks-os keeps them itself keyed by
        /// the invited address and reads them back in <see cref="SendProjectInvitationToNewUser"/>. A missing or
        /// expired entry falls back to no roles, which is the historical behaviour.
        /// </summary>
        private async Task CacheInvitationRolesAsync(string email, IReadOnlyCollection<EnviromentDetails> environments)
        {
            var rolesByTenant = environments
                .Where(e => e != null && !string.IsNullOrWhiteSpace(e.TenantId) && e.Roles is { Count: > 0 })
                .GroupBy(e => e.TenantId)
                .ToDictionary(g => g.Key, g => g.SelectMany(e => e.Roles).Distinct().ToList());

            if (rolesByTenant.Count == 0) return;

            await _cacheClient.AddStringValueAsync(
                InvitationRolesCacheKey(email),
                JsonSerializer.Serialize(rolesByTenant),
                ResolveInvitationLifetimeSeconds(null));
        }

        private async Task<Dictionary<string, List<string>>> GetCachedInvitationRolesAsync(string email)
        {
            var cached = await _cacheClient.GetStringValueAsync(InvitationRolesCacheKey(email));
            if (string.IsNullOrWhiteSpace(cached)) return new Dictionary<string, List<string>>();

            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, List<string>>>(cached) ?? new Dictionary<string, List<string>>();
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse cached invitation roles for the invited address; falling back to no roles");
                return new Dictionary<string, List<string>>();
            }
        }

        /// <summary>
        /// Hands the invitation to IAM, which creates the account if it is missing and mints an activation key
        /// if the account cannot sign in yet. IAM answers on <see cref="IdentifierConstants.IdentifierQueueName"/>,
        /// where <see cref="SendProjectInvitationToNewUser"/> creates the rows and sends the mail.
        /// </summary>
        private async Task<bool> RequestInvitationFromIam(string? email, IReadOnlyCollection<EnviromentDetails> environments, bool forceInvitation)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                _logger.LogWarning("RequestInvitationFromIam called with empty email");
                return false;
            }

            try
            {
                var tenantIds = environments
                    .Select(e => e.TenantId)
                    .Where(t => !string.IsNullOrWhiteSpace(t))
                    .Distinct()
                    .ToList();

                // The IAM round-trip does not carry the roles, so keep them on the blocks-os side and apply them
                // when the post-event handler creates the rows.
                await CacheInvitationRolesAsync(email, environments);

                var createUserCommand = new CreateUserByEmailEvent
                {
                    Email = email,
                    EventQueue = IdentifierConstants.IdentifierQueueName,
                    EventType = IdentifierConstants.ProjectPeopleInvitationMailPurpose,
                    TenantId = string.Join(";", tenantIds),
                    ForceInvitation = forceInvitation
                };

                await _messageClient.SendToConsumerAsync(
                    new ConsumerMessage<CreateUserByEmailEvent>
                    {
                        ConsumerName = IdentifierConstants.IamQueue,
                        Payload = createUserCommand
                    }
                );

                _logger.LogInformation("Invitation request sent to IAM for email: {Email}, ForceInvitation: {ForceInvitation}", email, forceInvitation);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending invitation request to IAM for email: {Email}", email);
                throw;
            }
        }

        public async Task<bool> ProcessInvitation(User user, List<string> ids, Tenant project, string activationKey, DateTime? keyExpiresAtUtc)
        {
            if (user == null)
            {
                _logger.LogWarning("ProcessInvitation called with null user");
                return false;
            }

            if (project == null)
            {
                _logger.LogWarning("ProcessInvitation called with null project");
                return false;
            }

            var invitationLifetimeSeconds = ResolveInvitationLifetimeSeconds(keyExpiresAtUtc);

            // The link must never outlive the activation key it carries: confirming against a dead key leaves the
            // person looking like a member while being unable to sign in, and that cannot be undone from the UI.
            if (invitationLifetimeSeconds <= 0)
            {
                _logger.LogError("Activation key for {Email} expires at {Expiry}, which has already passed; not sending an invitation",
                    user.Email, keyExpiresAtUtc);
                return false;
            }

            try
            {
                var invitationCode = await SendInvitationEmail(user, project);
                _logger.LogInformation("Invitation sent to {Email} for project {ProjectName}, valid for {LifetimeSeconds}s",
                    user.Email, project.Name, invitationLifetimeSeconds);
                await CacheInvitation(ids, activationKey, invitationCode, user.ItemId, project.TenantGroupId, project.TenantId, invitationLifetimeSeconds);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing invitation for user: {Email}", user.Email);
                throw;
            }
        }

        /// <summary>
        /// How long the invitation link stays valid. IAM owns the activation key's lifetime, so when the mail
        /// carries a key we never outlive it; otherwise the link is ours alone and takes the configured lifetime.
        /// </summary>
        private int ResolveInvitationLifetimeSeconds(DateTime? keyExpiresAtUtc)
        {
            var configuredMinutes = int.TryParse(_configuration["InvitationLifetimeInMinutes"], out var minutes) && minutes > 0
                ? minutes
                : CacheConstants.DefaultInvitationLifetimeInMinutes;

            var configuredSeconds = configuredMinutes * 60;

            if (!keyExpiresAtUtc.HasValue) return configuredSeconds;

            var keyLifetimeSeconds = (int)(keyExpiresAtUtc.Value - DateTime.UtcNow).TotalSeconds;

            return Math.Min(configuredSeconds, keyLifetimeSeconds);
        }

        public async Task<string> SendInvitationEmail(User user, Tenant project)
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

        private async Task CacheInvitation(List<string> ids, string activationKey, string invitationCode, string userId, string tenantGroupId, string tenantId, int lifetimeSeconds)
        {
            var cacheData = new CacheProjectPeopleInvitation
            {
                ProjectPeopleIds = string.Join(";", ids),
                UserActivationKey = activationKey,
                UserId = userId,
                TenantGroupId = tenantGroupId,
                TenantId = tenantId
            };

            await _cacheClient.AddStringValueAsync(
                invitationCode,
                JsonSerializer.Serialize(cacheData),
                lifetimeSeconds
            );

            _logger.LogInformation("Invitation cached for UserId: {UserId} in TenantGroupId: {TenantGroupId}", userId, tenantGroupId);
        }

        public async Task<BaseResponse> RemoveAccessFromProjectAsync(RemoveAccessRequest request)
        {
            if (request == null || request.TenantIds.Count == 0 || string.IsNullOrWhiteSpace(request.Email))
            {
                _logger.LogWarning("RemoveAccessFromProjectAsync called with invalid request");
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "invalid_request", "GroupId and Email are required" }
                    }
                };
            }

            request.Email = NormalizeEmail(request.Email);

            var tenants = await _projectRepository.GetProjectIdsByGroupId(request.GroupId);

            if (tenants == null || tenants.Count == 0)
            {
                _logger.LogWarning("No tenants found for GroupId: {GroupId}", request.GroupId);
                return new InviteResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.InvalidGroupId, "The given groupId is invalid" }
                        }
                };
            }

            var userId = BlocksContext.GetContext()?.UserId ?? string.Empty;

            if (!await _peopleRepository.IsOwner(userId, tenants))
            {
                return new InviteResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                        {
                            { "own_project", "You are not allowed to share this projects" }
                        }
                };
            }

            try
            {
                request.TenantIds = request.TenantIds.Where(pk => tenants.Contains(pk)).ToList();
                if (request.TenantIds.Count == 0)
                {
                    _logger.LogWarning("No valid project keys found for GroupId: {GroupId}", request.GroupId);
                    return new BaseResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.InvalidGroupId, "The given groupId is invalid" }
                        }
                    };
                }
                var existingUsers = await _peopleRepository.GetUsersByEmailAsync(new List<string> { request.Email });
                var user = existingUsers?.FirstOrDefault(u => u.Email == request.Email);

                if (user == null)
                {
                    _logger.LogWarning("User not found with email: {Email}", request.Email);
                    return new BaseResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.UserNotFound, $"User with email {request.Email} is not found" }
                        }
                    };
                }

                var result = await _peopleRepository.RemovePeoplesAsync(request.Email, request.TenantIds);

                _logger.LogInformation("Access removed for Email: {Email}, Result: {Result}", request.Email, result);

                return new RemoveAccessResponse { IsSuccess = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing access for Email: {Email}", request.Email);
                throw;
            }
        }

        public async Task<bool> SendProjectInvitationToNewUser(CreateUserByEmailPostEvent @event)
        {
            if (@event == null)
            {
                _logger.LogWarning("SendProjectInvitationToNewUser called with null event");
                return false;
            }

            // IAM reports a rejected invitation explicitly so it is not lost in silence. A null Success is a
            // legacy success (older IAM only posted back on success); only an explicit false is a reported failure.
            if (@event.Success == false)
            {
                _logger.LogError(
                    "IAM rejected the invitation for UserId: {UserId}. Reason: {FailureReason}",
                    @event.UserId,
                    string.IsNullOrWhiteSpace(@event.FailureReason) ? "(none provided)" : @event.FailureReason);
                return false;
            }

            if (string.IsNullOrWhiteSpace(@event.UserId) || string.IsNullOrWhiteSpace(@event.TenantId))
            {
                _logger.LogWarning("SendProjectInvitationToNewUser called with invalid event");
                return false;
            }

            if (!string.Equals(@event.EventType, IdentifierConstants.ProjectPeopleInvitationMailPurpose, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("Ignoring CreateUserByEmailPostEvent with unrelated EventType: {EventType}", @event.EventType);
                return false;
            }

            _logger.LogInformation("SendProjectInvitationToNewUser started for UserId: {UserId}", @event.UserId);

            try
            {
                var tenantIds = @event.TenantId.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();

                if (tenantIds.Count == 0)
                {
                    _logger.LogWarning("No valid tenant ids found in event");
                    return false;
                }

                var project = await _peopleRepository.GetProjectByIdAsync(tenantIds[0]);
                if (project == null)
                {
                    _logger.LogWarning("Project not found with ID: {ProjectId}", tenantIds[0]);
                    return false;
                }

                var user = await _peopleRepository.GetUserByIdAsync(@event.UserId);
                if (user == null)
                {
                    _logger.LogWarning("User not found with ID: {UserId}", @event.UserId);
                    return false;
                }

                // The broker may redeliver this event; only create the rows that aren't there yet.
                var existingPeople = await _peopleRepository.GetProjectPeoplesAsync(user.ItemId, tenantIds) ?? new List<ProjectPeople>();
                var existingTenantIds = existingPeople.Select(p => p.TenantId).ToHashSet();

                // The roles chosen at invite time were kept on the blocks-os side (the IAM round-trip drops them),
                // so the rows created here carry the same roles as the synchronous path would.
                var rolesByTenant = await GetCachedInvitationRolesAsync(user.Email);

                var projectPeoples = tenantIds
                    .Where(tenantId => !existingTenantIds.Contains(tenantId))
                    .Select(tenantId => CreateProjectPeople(
                        user,
                        tenantId,
                        user.Email,
                        rolesByTenant.TryGetValue(tenantId, out var roles) ? roles : []))
                    .ToList();

                // Nothing new to create. A resend still has to go out; a redelivery must not.
                if (projectPeoples.Count == 0 && !@event.ForceInvitation)
                {
                    _logger.LogInformation("User {Email} already has project people records for every requested environment; skipping invitation", user.Email);
                    return true;
                }

                if (projectPeoples.Count > 0)
                {
                    await _peopleRepository.InsertPeoplesAsync(projectPeoples);
                }

                // One link confirms everything still pending for this person, not just the rows created here.
                var projectPeopleIds = projectPeoples
                    .Select(x => x.ItemId)
                    .Concat(existingPeople.Where(p => !p.IsInvitationConfirmed).Select(p => p.ItemId))
                    .ToList();

                var result = await ProcessInvitation(user, projectPeopleIds, project, @event.Key, @event.KeyExpiresAtUtc);

                _logger.LogInformation("Project invitation sent to {Email}, Result: {Result}", user.Email, result);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending invitation to new user: {UserId}", @event.UserId);
                throw;
            }
        }

        /// <summary>
        /// Every project people row of <paramref name="userId"/> that is still awaiting confirmation within
        /// <paramref name="tenantGroupId"/>. Scoped to the group, so confirming one project never confirms another.
        /// Returns nothing for codes cached before these fields existed; those keep their snapshot behaviour.
        /// </summary>
        private async Task<List<string>> GetPendingProjectPeopleIdsAsync(string? userId, string? tenantGroupId)
        {
            if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(tenantGroupId))
            {
                _logger.LogInformation("Invitation cache has no user/group; confirming only the cached project people ids");
                return [];
            }

            var tenants = await _projectRepository.GetProjectIdsByGroupId(tenantGroupId);

            if (tenants == null || tenants.Count == 0)
            {
                _logger.LogWarning("No tenants found for TenantGroupId: {TenantGroupId}", tenantGroupId);
                return [];
            }

            var projectPeoples = await _peopleRepository.GetProjectPeoplesAsync(userId, tenants) ?? new List<ProjectPeople>();

            return projectPeoples
                .Where(p => !p.IsInvitationConfirmed)
                .Select(p => p.ItemId)
                .ToList();
        }

        public async Task<ConfirmInvitationResponse> ConfirmInvitationAsync(ConfirmInvitationRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Code))
            {
                _logger.LogWarning("ConfirmInvitationAsync called with empty code");
                return new ConfirmInvitationResponse
                {
                    Errors = new Dictionary<string, string>
                    {
                        { "invalid_code", "Invitation code is required" }
                    }
                };
            }

            // The code is a bearer credential; it must never reach the logs. Correlate on the user and group
            // carried in the cache entry instead.
            _logger.LogInformation("ConfirmInvitationAsync started");

            try
            {
                var cachedValue = await _cacheClient.GetStringValueAsync(request.Code);

                if (string.IsNullOrWhiteSpace(cachedValue))
                {
                    _logger.LogWarning("Invitation code not found or expired");
                    return new ConfirmInvitationResponse
                    {
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.CodeExpired, "The invitation code has expired or is invalid" }
                        }
                    };
                }

                var parsedData = JsonSerializer.Deserialize<CacheProjectPeopleInvitation>(cachedValue);

                // An invitation with nothing left to confirm is still valid: someone who accepted but never
                // activated gets a resend purely to carry a fresh activation key. Only a cache entry that
                // identifies neither rows nor a person is unusable.
                if (parsedData == null ||
                    (string.IsNullOrWhiteSpace(parsedData.ProjectPeopleIds) && string.IsNullOrWhiteSpace(parsedData.UserId)))
                {
                    _logger.LogWarning("Invalid cached invitation data");
                    return new ConfirmInvitationResponse
                    {
                        Errors = new Dictionary<string, string>
                        {
                            { "invalid_data", "Invalid invitation data" }
                        }
                    };
                }

                var ids = (parsedData.ProjectPeopleIds ?? string.Empty)
                    .Split(';', StringSplitOptions.RemoveEmptyEntries)
                    .ToList();

                // The cached ids are a snapshot from the moment the mail was sent, so an older link is blind to
                // environments added afterwards. Re-resolve everything still pending for this person in this
                // project group, so whichever link they click confirms the same set.
                var pendingIds = await GetPendingProjectPeopleIdsAsync(parsedData.UserId, parsedData.TenantGroupId);
                ids = ids.Union(pendingIds).ToList();

                if (ids.Count > 0)
                {
                    await _peopleRepository.UpdateProjectPeoples(ids);
                }

                await _cacheClient.RemoveKeyAsync(request.Code);

                _logger.LogInformation("Invitation confirmed for UserId: {UserId} in TenantGroupId: {TenantGroupId}. Rows confirmed: {Count}",
                    parsedData.UserId, parsedData.TenantGroupId, ids.Count);

                return new ConfirmInvitationResponse
                {
                    IsSuccess = true,
                    ActivationKey = parsedData.UserActivationKey ?? string.Empty,
                    TenantId = parsedData.TenantId ?? string.Empty
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming invitation");
                throw;
            }
        }

        public async Task<BaseResponse> ResendInvitationAsync(ResendInvitationRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.GroupId) || string.IsNullOrWhiteSpace(request.Email))
            {
                _logger.LogWarning("ResendInvitationAsync called with invalid request");
                return new BaseResponse
                {
                    IsSuccess = false,
                    Errors = new Dictionary<string, string>
                    {
                        { "invalid_request", "GroupId and Email are required" }
                    }
                };
            }

            request.Email = NormalizeEmail(request.Email);

            _logger.LogInformation("ResendInvitationAsync started for Email: {Email}, GroupId: {GroupId}",
                request.Email, request.GroupId);

            try
            {
                var tenants = await _projectRepository.GetProjectIdsByGroupId(request.GroupId);

                if (tenants == null || tenants.Count == 0)
                {
                    _logger.LogWarning("No tenants found for GroupId: {GroupId}", request.GroupId);
                    return new BaseResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.InvalidGroupId, "The given groupId is invalid" }
                        }
                    };
                }

                var bc = BlocksContext.GetContext();

                if (!await _peopleRepository.IsOwner(bc.UserId, tenants))
                {
                    return new InviteResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { "own_project", "You are not allowed to share this projects" }
                        }
                    };
                }

                var existingUsers = await _peopleRepository.GetUsersByEmailAsync(new List<string> { request.Email });
                var user = existingUsers?.FirstOrDefault(u => u.Email == request.Email);

                if (user == null)
                {
                    _logger.LogWarning("User not found with email: {Email}", request.Email);
                    return new BaseResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.UserNotFound, $"User with email {request.Email} is not found" }
                        }
                    };
                }

                var existingPeople = await _peopleRepository.GetProjectPeoplesAsync(user.ItemId, tenants);

                if (existingPeople == null || existingPeople.Count == 0)
                {
                    _logger.LogWarning("No invitations found for email: {Email}", request.Email);
                    return new BaseResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { ErrorCodes.InvitationNotFound, $"No invitation found for email {request.Email} with the given groupId" }
                        }
                    };
                }

                // Never activated, so the resent mail has to carry a fresh activation key. Only IAM can mint one:
                // it answers on the queue, and the post-event handler sends the mail.
                if (NeedsActivationKey(user))
                {
                    _logger.LogInformation("User {Email} is not activated; requesting a fresh activation key from IAM for the resend", request.Email);

                    // Preserve the roles already recorded on the existing rows so the resend re-provisions them
                    // consistently rather than dropping them.
                    var resendEnvironments = existingPeople
                        .GroupBy(p => p.TenantId)
                        .Select(g => new EnviromentDetails
                        {
                            TenantId = g.Key,
                            Roles = g.SelectMany(p => p.Roles ?? []).Distinct().ToList()
                        })
                        .ToList();

                    await RequestInvitationFromIam(user.Email, resendEnvironments, forceInvitation: true);

                    return new ResendInvitationResponse { IsSuccess = true };
                }

                var projectPeopleIds = existingPeople.Select(p => p.ItemId).ToList();
                var projectId = existingPeople.First().TenantId;
                var project = await _peopleRepository.GetProjectByIdAsync(projectId);

                if (project == null)
                {
                    _logger.LogWarning("Project not found with ID: {ProjectId}", projectId);
                    return new BaseResponse
                    {
                        IsSuccess = false,
                        Errors = new Dictionary<string, string>
                        {
                            { "project_not_found", "Associated project not found" }
                        }
                    };
                }

                var result = await ProcessInvitation(user, projectPeopleIds, project, string.Empty, null);

                _logger.LogInformation("Invitation resent to {Email}, Result: {Result}", request.Email, result);

                return new ResendInvitationResponse { IsSuccess = result };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resending invitation to {Email}", request.Email);
                throw;
            }
        }

        public async Task<BaseResponse> TransferOwnershipAsync(TransferOwnershipRequest request)
        {
            if(string.IsNullOrWhiteSpace(request.TenantGroupId))
            {
                return new BaseResponse { Errors = new Dictionary<string, string> {{"TenantGroupId", "TenantGroupId is required."}} };
            }

            if(string.IsNullOrWhiteSpace(request.TransferToUserEmail))
            {
                return new BaseResponse { Errors = new Dictionary<string, string> {{"TransferToUserEmail", "TransferToUserEmail is required."}} };
            }

            request.TransferToUserEmail = NormalizeEmail(request.TransferToUserEmail);

            var user = await _peopleRepository.GetUserByEmailAsync(request.TransferToUserEmail);

            if(user == null)
            {
                return new BaseResponse { Errors = new Dictionary<string, string> {{"TransferToUserEmail", "Must be an existing user"}} };
            }
            

            var tenantids = await _projectRepository.GetProjectIdsByGroupId(request.TenantGroupId);
            var bc = BlocksContext.GetContext();

            if (!await _peopleRepository.IsOwner(bc.UserId, tenantids) || NormalizeEmail(bc.UserName) == request.TransferToUserEmail)
            {
                return new BaseResponse { Errors = new Dictionary<string, string> { { "own_project", "You are not allowed to transfer ownership of this projects" } } };
            }

            var ownerProjectPeoples = await _peopleRepository.GetProjectPeoplesAsync(bc.UserId, tenantids);
            await _peopleRepository.UpdateProjectPeopleOwnerShipAsync([.. ownerProjectPeoples.Select(p => p.ItemId)], false);

            await _peopleRepository.UpdateProjectOwnerShipAsync([.. ownerProjectPeoples.Select(p => p.TenantId)], user.ItemId);

            List<string> projectPeopleIds = [];

            foreach (var tenantdId in tenantids)
            {
                var projectPeople = await _peopleRepository.GetProjectPeopleByTenantIdAndUserIdAsync(tenantdId, user.ItemId);

                if (projectPeople == null)
                {
                    projectPeople = new ProjectPeople { ItemId = Guid.NewGuid().ToString(), UserId = user.ItemId, TenantId = tenantdId, Email = user?.Email ?? "", IsCreator = true, LastUpdatedDate = DateTime.UtcNow, LastUpdatedBy = bc.UserId, IsInvitationConfirmed = true, IsInvitationSent = true };
                    await _peopleRepository.InsertPeoplesAsync([projectPeople]);
                }
                else
                {
                    projectPeopleIds.Add(projectPeople.ItemId);
                }

                await Task.Run(() => _tenants.UpdateTenantVersionAsync(new TenantCacheUpdateMessage
                {
                    Action = "upsert",
                    TenantId = tenantdId,
                    Tenant = _tenants.GetTenantByID(tenantdId)

                }));
            }

            if (projectPeopleIds.Count > 0)
                await _peopleRepository.UpdateProjectPeopleOwnerShipAsync(projectPeopleIds, true);

            return new BaseResponse { IsSuccess = true };
        }
    }
}
