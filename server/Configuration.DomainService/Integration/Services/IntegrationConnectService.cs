using System.Security.Cryptography;
using Blocks.Genesis;
using Configuration.DomainService.Integration.Entities;
using Configuration.DomainService.Integration.RequestModel;

namespace Configuration.DomainService.Integration.Services;

public sealed class IntegrationConnectService : IIntegrationConnectService
{
    private readonly IIntegrationRepository _templates;
    private readonly IIntegrationRequestRepository _requests;
    private readonly IIntegrationService _integration;
    private readonly ICryptoService _cryptoService;
    private readonly ITenants _tenants;

    public IntegrationConnectService(IIntegrationRepository templates, IIntegrationRequestRepository requests,
        IIntegrationService integration, ICryptoService cryptoService, ITenants tenants)
    {
        _templates = templates;
        _requests = requests;
        _integration = integration;
        _cryptoService = cryptoService;
        _tenants = tenants;
    }

    public async Task<(CreateIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> CreateRequestAsync(CreateIntegrationRequest request, CancellationToken cancellationToken = default)
    {
        var error = Validate(request, out var uri);
        if (error != null) return (null, error);
        var templates = await _templates.GetActiveTemplatesAsync(request.Family.Trim());
        if (templates.Count == 0) return (null, Error("family", "No active templates exist for this family."));
        if (!string.IsNullOrWhiteSpace(request.SuggestedTemplateKey) && !templates.Any(t => string.Equals(t.Key, request.SuggestedTemplateKey, StringComparison.Ordinal)))
            return (null, Error("suggested_template", "The suggested template does not belong to this family."));
        var now = DateTime.UtcNow;
        var item = new IntegrationRequest { ItemId = Guid.NewGuid().ToString(), Status = "pending", Family = request.Family.Trim(), SuggestedTemplateKey = request.SuggestedTemplateKey?.Trim(), RedirectUri = request.RedirectUri.Trim(), RedirectHost = uri!.Host, State = request.State, CodeChallenge = request.CodeChallenge, CodeChallengeMethod = "S256", SiteName = request.SiteName.Trim(), RootTenantId = BlocksContext.GetContext()?.TenantId ?? string.Empty, CreatedDate = now, LastUpdatedDate = now, ExpiresAt = now.AddMinutes(60) };
        await _requests.InsertAsync(item, cancellationToken);
        return (new CreateIntegrationRequestResponse { RequestId = item.ItemId, ExpiresAt = item.ExpiresAt }, null);
    }

    public async Task<(GetIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> GetRequestAsync(string requestId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(requestId)) return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));
        var userId = BlocksContext.GetContext()?.UserId;
        if (string.IsNullOrWhiteSpace(userId)) return (null, Error("unauthorized", "You must be logged in to view a connect request."));

        // The first read claims the request for this user and only this user; after that the
        // request is visible to them alone. TryClaim is idempotent for the same user.
        var request = await _requests.TryClaimAsync(requestId, userId, cancellationToken)
            ?? await _requests.GetByIdAsync(requestId, cancellationToken);
        if (request == null || request.ExpiresAt <= DateTime.UtcNow)
            return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));
        if (!string.Equals(request.ClaimedByUserId, userId, StringComparison.Ordinal))
            return (null, Error("request_claimed_by_other_user", "This connect request is already being handled by another user."));

        var templates = await _templates.GetActiveTemplatesAsync(request.Family);
        return (new GetIntegrationRequestResponse
        {
            RequestId = request.ItemId,
            SiteName = request.SiteName,
            RedirectHost = request.RedirectHost,
            Family = request.Family,
            Templates = templates
                .OrderBy(t => t.SortOrder)
                .Select(t => new IntegrationRequestTemplate { Key = t.Key, DisplayName = t.DisplayName, Description = t.Description, AccessLevel = t.AccessLevel, PermissionCount = t.Permissions.Count })
                .ToList(),
            SuggestedTemplateKey = request.SuggestedTemplateKey,
            Status = request.Status,
            ExpiresAt = request.ExpiresAt,
        }, null);
    }

    public async Task<(CancelIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> CancelRequestAsync(CancelIntegrationRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.RequestId)) return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));
        var userId = BlocksContext.GetContext()?.UserId;
        if (string.IsNullOrWhiteSpace(userId)) return (null, Error("unauthorized", "You must be logged in to cancel a connect request."));

        // Cancel transitions from pending only; an already-approved request cannot be cancelled
        // (the code would still be redeemable). Claim-first keeps strangers from cancelling.
        var existing = await _requests.GetByIdAsync(request.RequestId, cancellationToken);
        if (existing == null || existing.ExpiresAt <= DateTime.UtcNow)
            return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));
        if (!string.IsNullOrWhiteSpace(existing.ClaimedByUserId) && !string.Equals(existing.ClaimedByUserId, userId, StringComparison.Ordinal))
            return (null, Error("request_claimed_by_other_user", "This connect request is already being handled by another user."));
        if (existing.Status != "pending")
            return (null, Error("request_not_pending", "Only a pending connect request can be cancelled."));

        if (string.IsNullOrEmpty(existing.ClaimedByUserId))
            await _requests.TryClaimAsync(request.RequestId, userId, cancellationToken);
        var cancelled = await _requests.TryTransitionFromPendingAsync(request.RequestId, userId, "cancelled", cancellationToken);
        if (cancelled == null)
            return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));

        return (new CancelIntegrationRequestResponse { RedirectUrl = BuildRedirectUrl(existing, error: "access_denied") }, null);
    }

    /// <summary>The error redirect back to the CMS, built on the server from the stored RedirectUri.</summary>
    private static string BuildRedirectUrl(IntegrationRequest request, string error) =>
        $"{request.RedirectUri}{(request.RedirectUri.Contains('?') ? "&" : "?")}error={Uri.EscapeDataString(error)}&state={Uri.EscapeDataString(request.State)}";

    public async Task<(ApproveIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> ApproveRequestAsync(ApproveIntegrationRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.RequestId) || string.IsNullOrWhiteSpace(request.TemplateKey))
            return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));
        var userId = BlocksContext.GetContext()?.UserId;
        if (string.IsNullOrWhiteSpace(userId)) return (null, Error("unauthorized", "You must be logged in to approve a connect request."));

        var existing = await _requests.GetByIdAsync(request.RequestId, cancellationToken);
        if (existing == null || existing.ExpiresAt <= DateTime.UtcNow)
            return (null, Error("request_not_found_or_expired", "The connect request was not found or has expired."));
        if (!string.Equals(existing.ClaimedByUserId, userId, StringComparison.Ordinal))
            return (null, Error("request_claimed_by_other_user", "This connect request is already being handled by another user."));

        // A repeat approval gets a fresh raw code. We only store code hashes, so returning the
        // old hash would make the CMS hash it again and fail exchange.
        if (existing.Status == "approved")
            return await ReissueApprovedCodeAsync(existing, request.TemplateKey, userId, cancellationToken);
        if (existing.Status != "pending")
            return (null, Error("request_not_pending", "Only a pending connect request can be approved."));

        // Reserve the request before calling IAM. This prevents two browser clicks from making
        // two client credentials and means a cancel cannot overwrite a completed setup.
        existing = await _requests.TryStartApprovalAsync(request.RequestId, userId, cancellationToken);
        if (existing == null)
        {
            var current = await _requests.GetByIdAsync(request.RequestId, cancellationToken);
            if (current?.Status == "approved" && string.Equals(current.ClaimedByUserId, userId, StringComparison.Ordinal))
                return await ReissueApprovedCodeAsync(current, request.TemplateKey, userId, cancellationToken);
            return (null, Error("request_not_pending", "Only a pending connect request can be approved."));
        }

        try
        {
            var templates = await _templates.GetActiveTemplatesAsync(existing.Family);
            var template = templates.FirstOrDefault(t => string.Equals(t.Key, request.TemplateKey, StringComparison.Ordinal));
            if (template == null)
            {
                await _requests.ResetApprovalToPendingAsync(existing.ItemId, cancellationToken);
                return (null, Error("template_not_found", "The template does not belong to this connect request's family."));
            }

            var context = BlocksContext.GetContext()!;
            if (!context.Impersonated)
            {
                await _requests.ResetApprovalToPendingAsync(existing.ItemId, cancellationToken);
                return (null, Error("project", "Open a project environment to approve this connect request."));
            }

            var setup = await _integration.RunSetupAsync(new RunIntegrationSetupRequest
            {
                TemplateKey = template.Key,
                ConnectionName = BuildConnectionName(existing),
                Source = "connect",
                SiteUrl = new Uri(existing.RedirectUri).GetLeftPart(UriPartial.Authority),
            });
            if (!setup.IsSuccess || string.IsNullOrWhiteSpace(setup.ClientSecret) || string.IsNullOrWhiteSpace(setup.ClientId))
            {
                await _requests.ResetApprovalToPendingAsync(existing.ItemId, cancellationToken);
                return (null, MergeErrors(setup.Errors as Dictionary<string, string> ?? setup.Errors?.ToDictionary(e => e.Key, e => e.Value), "approve_failed"));
            }

            var environmentTenant = _tenants.GetTenantByID(context.TenantId);
            if (string.IsNullOrWhiteSpace(environmentTenant?.TenantSalt))
            {
                await _integration.DisconnectAsync(setup.ConnectionId);
                await _requests.ResetApprovalToPendingAsync(existing.ItemId, cancellationToken);
                return (null, Error("approve_failed", "The environment encryption key is unavailable."));
            }

            // 32 random bytes, base64url: the one-time code. Only its hash is stored; the raw value
            // appears exactly once, in the redirect URL returned to the claimer's browser.
            var code = Base64Url(RandomNumberGenerator.GetBytes(32));
            var now = DateTime.UtcNow;
            var approved = new IntegrationRequest
            {
            ItemId = existing.ItemId,
            Status = "approved",
            ClaimedByUserId = existing.ClaimedByUserId,
            Family = existing.Family,
            SuggestedTemplateKey = existing.SuggestedTemplateKey,
            RedirectUri = existing.RedirectUri,
            RedirectHost = existing.RedirectHost,
            State = existing.State,
            CodeChallenge = existing.CodeChallenge,
            CodeChallengeMethod = existing.CodeChallengeMethod,
            SiteName = existing.SiteName,
            RootTenantId = existing.RootTenantId,
            EnvironmentTenantId = context.TenantId,
            TemplateKey = template.Key,
            ConnectionId = setup.ConnectionId,
            CodeHash = Hash(code),
            ClientId = setup.ClientId,
            SecretCipher = _cryptoService.Encrypt(setup.ClientSecret, environmentTenant.TenantSalt),
            CreatedDate = existing.CreatedDate,
            LastUpdatedDate = now,
            ApprovedDate = now,
            ExpiresAt = now.AddMinutes(5),
            };
            if (!await _requests.TryCompleteApprovalAsync(approved, cancellationToken))
            {
                await _integration.DisconnectAsync(setup.ConnectionId);
                await _requests.ResetApprovalToPendingAsync(existing.ItemId, cancellationToken);
                return (null, Error("request_not_pending", "The connect request is no longer pending."));
            }

            return (new ApproveIntegrationRequestResponse { RedirectUrl = BuildCodeRedirectUrl(approved, code) }, null);
        }
        catch
        {
            await _requests.ResetApprovalToPendingAsync(existing.ItemId, cancellationToken);
            return (null, Error("approve_failed", "The integration setup did not complete."));
        }
    }

    public async Task<(ExchangeIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> ExchangeAsync(ExchangeIntegrationRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.CodeVerifier) || string.IsNullOrWhiteSpace(request.RedirectUri))
            return (null, Error("invalid_code", "The code, verifier and redirect URI are all required."));

        var codeHash = Hash(request.Code);
        var verifierHash = Base64Url(SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(request.CodeVerifier)));
        var matched = await _requests.TryExchangeByCodeHashAsync(codeHash, request.RedirectUri, verifierHash, cancellationToken);
        if (matched == null)
        {
            // Any failed match burns the code: guessing, replaying or a mismatched redirect must
            // not leave a redeemable code behind. The atomic exchange above already consumed a
            // genuine one; this only marks records that did not satisfy every condition.
            var failed = await _requests.MarkFailedByCodeHashAsync(codeHash, cancellationToken);
            if (!string.IsNullOrWhiteSpace(failed?.EnvironmentTenantId) && !string.IsNullOrWhiteSpace(failed.ConnectionId))
                await _integration.RevokeUndeliveredConnectionAsync(failed.EnvironmentTenantId, failed.ConnectionId);
            return (null, Error("invalid_code", "The code is invalid, expired or already used."));
        }

        var environmentTenant = _tenants.GetTenantByID(matched.EnvironmentTenantId!);
        if (string.IsNullOrWhiteSpace(environmentTenant?.TenantSalt) || string.IsNullOrWhiteSpace(matched.SecretCipher))
            return (null, Error("invalid_code", "The code is invalid, expired or already used."));
        var secret = _cryptoService.Decrypt(matched.SecretCipher, environmentTenant.TenantSalt);
        if (string.IsNullOrWhiteSpace(secret))
            return (null, Error("invalid_code", "The code is invalid, expired or already used."));
        var template = await _templates.GetTemplateByKeyAsync(matched.TemplateKey!, includeInactive: true);
        var domain = environmentTenant.Applications?.FirstOrDefault()?.Domain ?? string.Empty;

        return (new ExchangeIntegrationRequestResponse
        {
            ClientId = matched.ClientId!,
            ClientSecret = secret,
            XBlocksKey = matched.EnvironmentTenantId!,
            BaseUrl = template?.BaseUrl ?? string.Empty,
            Domain = domain,
            TemplateKey = matched.TemplateKey!,
            AccessLevel = template?.AccessLevel ?? string.Empty,
        }, null);

    }

    private async Task<(ApproveIntegrationRequestResponse? Response, Dictionary<string, string>? Errors)> ReissueApprovedCodeAsync(IntegrationRequest existing, string templateKey, string userId, CancellationToken cancellationToken)
    {
        if (!string.Equals(existing.TemplateKey, templateKey, StringComparison.Ordinal))
            return (null, Error("request_not_pending", "This request was already approved with a different template."));
        var code = Base64Url(RandomNumberGenerator.GetBytes(32));
        var renewed = await _requests.RotateApprovedCodeAsync(existing.ItemId, userId, templateKey, Hash(code), cancellationToken);
        if (renewed == null)
            return (null, Error("request_not_pending", "The connect request is no longer available."));
        return (new ApproveIntegrationRequestResponse { RedirectUrl = BuildCodeRedirectUrl(renewed, code) }, null);
    }

    internal static string BuildConnectionName(IntegrationRequest request)
    {
        const int maxLength = 60;
        const string separator = " · ";
        var suffix = request.ItemId.Length <= 6 ? request.ItemId : request.ItemId[..6];
        var baseName = string.IsNullOrWhiteSpace(request.SiteName) ? request.RedirectHost : request.SiteName.Trim();
        var availableBaseLength = Math.Max(1, maxLength - separator.Length - suffix.Length);
        if (baseName.Length > availableBaseLength) baseName = baseName[..availableBaseLength].TrimEnd();
        return $"{baseName}{separator}{suffix}";
    }

    /// <summary>The success redirect carrying the one-time code, built from the stored RedirectUri.</summary>
    private static string BuildCodeRedirectUrl(IntegrationRequest request, string code) =>
        $"{request.RedirectUri}{(request.RedirectUri.Contains('?') ? "&" : "?")}code={Uri.EscapeDataString(code)}&state={Uri.EscapeDataString(request.State)}&blocks_key={Uri.EscapeDataString(request.RootTenantId)}";

    internal static string Hash(string value) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));

    internal static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static Dictionary<string, string> MergeErrors(Dictionary<string, string>? errors, string fallbackKey) =>
        errors is { Count: > 0 } ? errors : new Dictionary<string, string> { [fallbackKey] = "The integration setup did not complete." };

    private static Dictionary<string, string>? Validate(CreateIntegrationRequest request, out Uri? uri)
    {
        uri = null;
        if (string.IsNullOrWhiteSpace(request.Family)) return Error("family", "Family is required.");
        if (request.RedirectUri.Length > 2048 || !Uri.TryCreate(request.RedirectUri, UriKind.Absolute, out uri) || !string.IsNullOrEmpty(uri.Fragment) || (uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && (uri.Host is "localhost" or "127.0.0.1")))) return Error("invalid_redirect_uri", "RedirectUri must be HTTPS (or HTTP localhost) without a fragment.");
        if (request.State.Length is < 16 or > 512) return Error("state", "State must be 16 to 512 characters.");
        if (request.CodeChallengeMethod != "S256" || !System.Text.RegularExpressions.Regex.IsMatch(request.CodeChallenge, "^[A-Za-z0-9_-]{43}$")) return Error("code_challenge", "CodeChallenge must be a 43-character base64url S256 challenge.");
        if (string.IsNullOrWhiteSpace(request.SiteName) || request.SiteName.Trim().Length > 100 || request.SiteName.Any(char.IsControl)) return Error("site_name", "SiteName must be plain text up to 100 characters.");
        return null;
    }
    private static Dictionary<string, string> Error(string key, string message) => new() { [key] = message };
}
