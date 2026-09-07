using System.Text;
using System.Text.RegularExpressions;

namespace Blocks.Secrets;

public sealed partial class SecretService
{
    /// <summary>
    /// Allowed secret names. Constrained so a name can safely appear in a URL, a config key or
    /// a log line without escaping.
    /// </summary>
    [GeneratedRegex("^[A-Za-z0-9][A-Za-z0-9._-]*$", RegexOptions.CultureInvariant)]
    private static partial Regex NamePattern();

    #region Validation

    private static void ValidateSetRequest(SetSecretRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);

        ValidateName(request.Name);
        ValidateDescription(request.Description);
        ValidateTags(request.Tags);
        ValidateValue(request.Value);

        if (!SecretTypes.IsValid(request.Type))
        {
            throw new SecretValidationException(
                $"'{request.Type}' is not a valid secret type. Expected '{SecretTypes.Api}', '{SecretTypes.Service}' or '{SecretTypes.Both}'.",
                "INVALID_TYPE");
        }
    }

    private static void ValidateName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new SecretValidationException("A secret name is required.", "NAME_REQUIRED");
        }

        if (name.Length > MaxNameLength)
        {
            throw new SecretValidationException($"A secret name may be at most {MaxNameLength} characters.", "NAME_TOO_LONG");
        }

        if (!NamePattern().IsMatch(name))
        {
            throw new SecretValidationException(
                "A secret name must start with a letter or digit and may contain only letters, digits, dot, underscore and hyphen.",
                "NAME_INVALID");
        }
    }

    private static void ValidateDescription(string? description)
    {
        if (description is not null && description.Length > MaxDescriptionLength)
        {
            throw new SecretValidationException($"A description may be at most {MaxDescriptionLength} characters.", "DESCRIPTION_TOO_LONG");
        }
    }

    /// <summary>
    /// Validates the normalized form, so a caller is never rejected for casing or padding that
    /// the write would have removed anyway.
    /// </summary>
    private static void ValidateTags(IReadOnlyCollection<string>? tags)
    {
        if (tags is null)
        {
            return;
        }

        var normalized = SecretTag.NormalizeAll(tags);

        if (normalized.Count > SecretTag.MaxPerSecret)
        {
            throw new SecretValidationException(
                $"A secret may carry at most {SecretTag.MaxPerSecret} tags; {normalized.Count} were supplied.", "TOO_MANY_TAGS");
        }

        var malformed = normalized.FirstOrDefault(tag => !SecretTag.IsWellFormed(tag));
        if (malformed is not null)
        {
            throw new SecretValidationException(
                $"'{malformed}' is not a valid tag. A tag must start with a letter or digit, may contain only letters, " +
                $"digits, dot, underscore, hyphen and colon, and may be at most {SecretTag.MaxLength} characters.",
                "TAG_INVALID");
        }
    }

    /// <summary>
    /// Normalizes the tags on a list filter and caps how many one query may carry.
    /// </summary>
    /// <remarks>
    /// A malformed tag is not rejected here, unlike on a write: a filter value that cannot
    /// match anything is an empty result, not a bad request, and a filter bar that 400s
    /// because of what someone typed is worse than one that shows nothing.
    /// </remarks>
    private static List<string>? NormalizeFilterTags(IReadOnlyCollection<string>? tags)
    {
        if (tags is null || tags.Count == 0)
        {
            return null;
        }

        var normalized = SecretTag.NormalizeAll(tags);

        if (normalized.Count > SecretTag.MaxPerFilter)
        {
            throw new SecretValidationException(
                $"At most {SecretTag.MaxPerFilter} tags may be supplied in a filter; {normalized.Count} were.", "TOO_MANY_TAGS");
        }

        return normalized;
    }

    private static void ValidateValue(string? value)
    {
        if (value is null)
        {
            throw new SecretValidationException("A secret value is required.", "VALUE_REQUIRED");
        }

        // Measured in bytes, not characters: Key Vault's limit is on the encoded payload, so a
        // character count would let multi-byte values through and fail at the vault instead.
        var byteCount = Encoding.UTF8.GetByteCount(value);
        if (byteCount > SecretDefaults.MaxValueLengthBytes)
        {
            throw new SecretValidationException(
                $"A secret value may be at most {SecretDefaults.MaxValueLengthBytes} bytes; this one is {byteCount}.", "VALUE_TOO_LARGE");
        }
    }

    #endregion

    #region Loading and state

    private async Task<Secret> LoadAsync(SecretCallerContext caller, string secretId, CancellationToken cancellationToken)
    {
        var secret = await _repository.GetAsync(caller.TenantId, secretId, cancellationToken).ConfigureAwait(false);
        return secret ?? throw new SecretNotFoundException(secretId);
    }

    /// <summary>
    /// Loads a secret for a metadata mutation.
    /// </summary>
    /// <remarks>
    /// Mutations follow the same access rules as a value read: someone who may not read a
    /// secret must not be able to rename it, rotate it, or hand themselves access to it.
    /// Deleted secrets are excluded here — they are handled by restore, not by update.
    /// </remarks>
    private async Task<Secret> LoadForMutationAsync(
        SecretCallerContext caller,
        string secretId,
        string actionLabel,
        CancellationToken cancellationToken)
    {
        var secret = await LoadAsync(caller, secretId, cancellationToken).ConfigureAwait(false);

        EnsureTransitionAllowed(secret, actionLabel, [SecretStatuses.Active, SecretStatuses.Locked]);

        if (!caller.IsRoot && SecretTypes.HasAccessList(secret.Type))
        {
            var denial = CheckMutationAccess(caller, secret);
            if (denial is not null)
            {
                await _audit.RecordAsync(
                    caller,
                    SecretAuditActions.AccessDenied,
                    secret,
                    SecretAuditOutcomes.Denied,
                    denial,
                    cancellationToken: cancellationToken).ConfigureAwait(false);

                throw new SecretAccessDeniedException(denial);
            }
        }

        return secret;
    }

    /// <summary>
    /// Access-list check for mutations, independent of status.
    /// </summary>
    /// <remarks>
    /// Cannot reuse <see cref="ISecretAuthorizationService.CheckValueRead"/> directly: that
    /// refuses locked secrets, but unlocking a locked secret has to be possible.
    /// </remarks>
    private static string? CheckMutationAccess(SecretCallerContext caller, Secret secret)
    {
        var access = secret.Access;

        if (access is null || access.IsEmpty)
        {
            return string.Equals(secret.CreatedBy, caller.UserId, StringComparison.Ordinal) && !string.IsNullOrEmpty(caller.UserId)
                ? null
                : SecretAuditReasons.NotInAccessList;
        }

        if (!string.IsNullOrEmpty(caller.UserId) && access.UserIds.Contains(caller.UserId, StringComparer.Ordinal))
        {
            return null;
        }

        if (access.Roles.Count > 0 && caller.Roles.Any(role => access.Roles.Contains(role, StringComparer.Ordinal)))
        {
            return null;
        }

        return SecretAuditReasons.NotInAccessList;
    }

    private static void EnsureTransitionAllowed(Secret secret, string actionLabel, string[] allowedFrom)
    {
        if (!allowedFrom.Contains(secret.Status, StringComparer.Ordinal))
        {
            throw new SecretStateException(secret.Status, actionLabel);
        }
    }

    private static void Touch(Secret secret, SecretCallerContext caller)
    {
        secret.LastUpdatedBy = caller.UserId;
        secret.LastUpdatedDate = DateTime.UtcNow;
    }

    #endregion

    #region Mapping

    private static Secret BuildSecret(SecretCallerContext caller, SetSecretRequest request, string organizationId)
    {
        var now = DateTime.UtcNow;

        return new Secret
        {
            // "N" format keeps the id inside Key Vault's [0-9a-zA-Z-] name rule once prefixed.
            ItemId = Guid.NewGuid().ToString("N"),
            TenantId = caller.TenantId,
            OrganizationId = organizationId,
            Name = request.Name,
            NameLower = SecretName.Normalize(request.Name),
            Description = request.Description,
            Tags = SecretTag.NormalizeAll(request.Tags),
            Type = request.Type,
            Status = SecretStatuses.Active,

            // Types without an access list must not carry one; a stored list would imply a
            // check that is never performed.
            Access = SecretTypes.HasAccessList(request.Type) ? request.Access : null,

            CreatedBy = caller.UserId,
            CreatedDate = now,
            LastUpdatedBy = caller.UserId,
            LastUpdatedDate = now
        };
    }

    private SecretResult ToResult(SecretCallerContext caller, Secret secret) => new()
    {
        SecretId = secret.ItemId,
        Name = secret.Name,
        Description = secret.Description,
        // Coalesced: a secret stored before tags existed carries no Tags element, and the
        // client types this as a plain array.
        Tags = secret.Tags ?? [],
        Type = secret.Type,
        Status = secret.Status,
        OrganizationId = secret.OrganizationId,
        Access = secret.Access,
        CreatedDate = secret.CreatedDate,
        CreatedBy = secret.CreatedBy,
        LastUpdatedDate = secret.LastUpdatedDate,
        LastUpdatedBy = secret.LastUpdatedBy,
        LastRotatedDate = secret.LastRotatedDate,
        LastRotatedBy = secret.LastRotatedBy,
        RotationCount = secret.RotationCount,
        DeletedDate = secret.DeletedDate,
        DeletedBy = secret.DeletedBy,

        // Pre-evaluated so a UI can enable or disable reveal without a speculative call that
        // would otherwise show up in the audit log as a denial.
        CanReadValue = _authorization.CheckValueRead(caller, secret) is null
    };

    private static SecretAuditLogResult ToAuditResult(SecretAuditLog log) => new()
    {
        AuditId = log.ItemId,
        SecretId = log.SecretId,
        SecretName = log.SecretName,
        Action = log.Action,
        Outcome = log.Outcome,
        Reason = log.Reason,
        ActorUserId = log.ActorUserId,
        ActorRoles = log.ActorRoles,
        IsRootOverride = log.IsRootOverride,
        Impersonated = log.Impersonated,
        RequestUri = log.RequestUri,
        TraceId = log.TraceId,
        AffectedCount = log.AffectedCount,
        CreatedDate = log.CreatedDate
    };

    #endregion
}
