using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace Blocks.Secrets;

public sealed partial class SecretService : ISecretService
{
    private const int MaxNameLength = 100;
    private const int MaxDescriptionLength = 1000;

    private readonly ISecretRepository _repository;
    private readonly ISecretAuditRepository _auditRepository;
    private readonly ISecretValueStore _valueStore;
    private readonly ISecretAuthorizationService _authorization;
    private readonly ISecretAuditService _audit;
    private readonly ILogger<SecretService> _logger;

    public SecretService(
        ISecretRepository repository,
        ISecretAuditRepository auditRepository,
        ISecretValueStore valueStore,
        ISecretAuthorizationService authorization,
        ISecretAuditService audit,
        ILogger<SecretService> logger)
    {
        _repository = repository;
        _auditRepository = auditRepository;
        _valueStore = valueStore;
        _authorization = authorization;
        _audit = audit;
        _logger = logger;
    }

    #region Create

    public async Task<string> SetAsync(SetSecretRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var caller = _authorization.ResolveContext();
        ValidateSetRequest(request);

        var organizationId = string.IsNullOrWhiteSpace(request.OrganizationId)
            ? caller.OrganizationId
            : request.OrganizationId;

        var secret = BuildSecret(caller, request, organizationId);

        await CreateAsync(caller, secret, request.Value, cancellationToken).ConfigureAwait(false);
        await _audit.RecordAsync(caller, SecretAuditActions.Set, secret, cancellationToken: cancellationToken).ConfigureAwait(false);

        return secret.ItemId;
    }

    public async Task<IReadOnlyDictionary<string, string>> SetManyAsync(
        IReadOnlyCollection<SetSecretRequest> requests,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(requests);

        var caller = _authorization.ResolveContext();

        if (requests.Count == 0)
        {
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }

        if (requests.Count > SecretDefaults.MaxBatchSize)
        {
            throw new SecretValidationException(
                $"A batch may contain at most {SecretDefaults.MaxBatchSize} secrets; {requests.Count} were supplied.", "BATCH_TOO_LARGE");
        }

        // Validate the whole batch before touching the vault. Discovering item 40 is malformed
        // after writing 39 secrets would mean compensating work that never needed to start.
        foreach (var request in requests)
        {
            ValidateSetRequest(request);
        }

        var duplicate = requests
            .GroupBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate is not null)
        {
            throw new SecretValidationException($"The batch contains '{duplicate.Key}' more than once.", "DUPLICATE_NAME_IN_BATCH");
        }

        var created = new List<Secret>();
        var result = new Dictionary<string, string>(StringComparer.Ordinal);

        try
        {
            foreach (var request in requests)
            {
                var organizationId = string.IsNullOrWhiteSpace(request.OrganizationId)
                    ? caller.OrganizationId
                    : request.OrganizationId;

                var secret = BuildSecret(caller, request, organizationId);
                await CreateAsync(caller, secret, request.Value, cancellationToken).ConfigureAwait(false);

                created.Add(secret);
                result[request.Name] = secret.ItemId;
            }
        }
        catch
        {
            // All-or-nothing: a partially applied batch would leave the caller unable to tell
            // which credentials now exist, which is worse than none of them existing.
            await CompensateAsync(caller, created).ConfigureAwait(false);
            throw;
        }

        foreach (var secret in created)
        {
            await _audit.RecordAsync(caller, SecretAuditActions.Set, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
        }

        await _audit.RecordAsync(caller, SecretAuditActions.SetMany, affectedCount: created.Count, cancellationToken: cancellationToken).ConfigureAwait(false);

        return result;
    }

    /// <summary>
    /// Vault first, then metadata.
    /// </summary>
    /// <remarks>
    /// The ordering is what makes this safe without a distributed transaction. If the vault
    /// write fails, nothing is written to Mongo. If the metadata write fails, the vault entry
    /// is deleted; and if that cleanup also fails, the orphaned key is recorded so it can be
    /// reconciled. The only reachable inconsistency is a vault entry no metadata points at,
    /// which nothing can read.
    /// </remarks>
    private async Task CreateAsync(SecretCallerContext caller, Secret secret, string value, CancellationToken cancellationToken)
    {
        await _valueStore.SetAsync(secret.ItemId, value, cancellationToken).ConfigureAwait(false);

        try
        {
            await _repository.InsertAsync(secret, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception metadataException)
        {
            try
            {
                await _valueStore.DeleteAsync(secret.ItemId, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception cleanupException)
            {
                _logger.LogError(cleanupException,
                    "Metadata write failed for secret {SecretId} and the compensating vault delete also failed. " +
                    "The vault entry is orphaned and needs manual reconciliation.", secret.ItemId);

                await _audit.RecordAsync(
                    caller,
                    SecretAuditActions.VaultOrphan,
                    outcome: SecretAuditOutcomes.Failed,
                    reason: SecretAuditReasons.CleanupFailed,
                    secretId: secret.ItemId,
                    cancellationToken: CancellationToken.None).ConfigureAwait(false);
            }

            await _audit.RecordAsync(
                caller,
                SecretAuditActions.Set,
                secret,
                SecretAuditOutcomes.Failed,
                SecretAuditReasons.MetadataWriteFailed,
                cancellationToken: CancellationToken.None).ConfigureAwait(false);

            throw new SecretValidationException(
                $"Could not persist metadata for secret '{secret.Name}'. {metadataException.Message}",
                SecretAuditReasons.MetadataWriteFailed);
        }
    }

    private async Task CompensateAsync(SecretCallerContext caller, IReadOnlyList<Secret> created)
    {
        foreach (var secret in created)
        {
            try
            {
                await _repository.HardDeleteAsync(caller.TenantId, secret.ItemId, CancellationToken.None).ConfigureAwait(false);
                await _valueStore.DeleteAsync(secret.ItemId, CancellationToken.None).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Could not roll back secret {SecretId} after a failed batch. It may need manual removal.", secret.ItemId);

                await _audit.RecordAsync(
                    caller,
                    SecretAuditActions.VaultOrphan,
                    outcome: SecretAuditOutcomes.Failed,
                    reason: SecretAuditReasons.CleanupFailed,
                    secretId: secret.ItemId,
                    cancellationToken: CancellationToken.None).ConfigureAwait(false);
            }
        }
    }

    #endregion

    #region Read

    public async Task<SecretResult?> GetAsync(string secretId, CancellationToken cancellationToken = default)
    {
        var caller = _authorization.ResolveContext();
        var secret = await _repository.GetAsync(caller.TenantId, secretId, cancellationToken).ConfigureAwait(false);

        if (secret is null)
        {
            return null;
        }

        return ToResult(caller, secret);
    }

    public async Task<SecretListResult> FindAsync(SecretFilter filter, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var caller = _authorization.ResolveContext();

        filter.PageNumber = Math.Max(1, filter.PageNumber);
        filter.PageSize = Math.Clamp(filter.PageSize, 1, SecretDefaults.MaxPageSize);

        var (items, total) = await _repository.FindAsync(caller.TenantId, filter, cancellationToken).ConfigureAwait(false);

        return new SecretListResult
        {
            Data = items.Select(secret => ToResult(caller, secret)).ToList(),
            TotalCount = total
        };
    }

    public async Task<string> GetValueAsync(string secretId, CancellationToken cancellationToken = default)
    {
        var caller = _authorization.ResolveContext();
        return await ReadValueAsync(caller, secretId, cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyDictionary<string, string>> GetValuesAsync(
        IReadOnlyCollection<string> secretIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(secretIds);

        var caller = _authorization.ResolveContext();

        if (secretIds.Count == 0)
        {
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }

        if (secretIds.Count > SecretDefaults.MaxBatchSize)
        {
            throw new SecretValidationException(
                $"A batch may contain at most {SecretDefaults.MaxBatchSize} secrets; {secretIds.Count} were supplied.", "BATCH_TOO_LARGE");
        }

        var values = new Dictionary<string, string>(StringComparer.Ordinal);

        // Strict: every id must resolve and every id must be authorized. Silently dropping the
        // ones the caller cannot read would hand back a partial credential set that looks
        // complete at the call site.
        foreach (var secretId in secretIds.Distinct(StringComparer.Ordinal))
        {
            values[secretId] = await ReadValueAsync(caller, secretId, cancellationToken).ConfigureAwait(false);
        }

        await _audit.RecordAsync(caller, SecretAuditActions.GetValues, affectedCount: values.Count, cancellationToken: cancellationToken).ConfigureAwait(false);

        return values;
    }

    private async Task<string> ReadValueAsync(SecretCallerContext caller, string secretId, CancellationToken cancellationToken)
    {
        var secret = await _repository.GetAsync(caller.TenantId, secretId, cancellationToken).ConfigureAwait(false);

        if (secret is null)
        {
            // 404 rather than 403, even when the id exists under another tenant: a 403 would
            // confirm the id is real and leak the shape of other tenants' data.
            await _audit.RecordAsync(
                caller,
                SecretAuditActions.AccessDenied,
                outcome: SecretAuditOutcomes.Denied,
                secretId: secretId,
                cancellationToken: cancellationToken).ConfigureAwait(false);

            throw new SecretNotFoundException(secretId);
        }

        var denial = _authorization.CheckValueRead(caller, secret);
        if (denial is not null)
        {
            await _audit.RecordAsync(
                caller,
                SecretAuditActions.AccessDenied,
                secret,
                SecretAuditOutcomes.Denied,
                denial,
                cancellationToken: cancellationToken).ConfigureAwait(false);

            _authorization.EnsureValueRead(caller, secret);
        }

        string? value;
        try
        {
            value = await _valueStore.GetAsync(secret.ItemId, cancellationToken).ConfigureAwait(false);
        }
        catch (SecretVaultException)
        {
            await _audit.RecordAsync(
                caller,
                SecretAuditActions.GetValue,
                secret,
                SecretAuditOutcomes.Failed,
                SecretAuditReasons.VaultFailure,
                cancellationToken: cancellationToken).ConfigureAwait(false);
            throw;
        }

        if (value is null)
        {
            await _audit.RecordAsync(
                caller,
                SecretAuditActions.GetValue,
                secret,
                SecretAuditOutcomes.Failed,
                SecretAuditReasons.ValueMissing,
                cancellationToken: cancellationToken).ConfigureAwait(false);

            throw new SecretNotFoundException(secretId, SecretAuditReasons.ValueMissing);
        }

        await _audit.RecordAsync(caller, SecretAuditActions.GetValue, secret, cancellationToken: cancellationToken).ConfigureAwait(false);

        return value;
    }

    #endregion

    #region Mutate

    public async Task UpdateAsync(string secretId, UpdateSecretRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var caller = _authorization.ResolveContext();
        var secret = await LoadForMutationAsync(caller, secretId, "update", cancellationToken).ConfigureAwait(false);

        if (request.Name is not null)
        {
            ValidateName(request.Name);

            secret.Name = request.Name;
            secret.NameLower = SecretName.Normalize(request.Name);
        }

        if (request.Description is not null)
        {
            ValidateDescription(request.Description);
            secret.Description = request.Description;
        }

        Touch(secret, caller);
        await _repository.ReplaceAsync(secret, cancellationToken).ConfigureAwait(false);
        await _audit.RecordAsync(caller, SecretAuditActions.Update, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public async Task RotateAsync(string secretId, RotateSecretRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var caller = _authorization.ResolveContext();
        var secret = await LoadForMutationAsync(caller, secretId, "rotate", cancellationToken).ConfigureAwait(false);

        ValidateValue(request.Value);

        await _valueStore.SetAsync(secret.ItemId, request.Value, cancellationToken).ConfigureAwait(false);

        secret.LastRotatedBy = caller.UserId;
        secret.LastRotatedDate = DateTime.UtcNow;
        secret.RotationCount++;
        Touch(secret, caller);

        try
        {
            await _repository.ReplaceAsync(secret, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // The new value is already live and readable, so this is safe but inconsistent:
            // rotation bookkeeping is behind. Recorded for reconciliation rather than rolled
            // back — reverting the vault would put the old credential back into service.
            _logger.LogError(ex,
                "Rotated the vault value for secret {SecretId} but could not update its metadata.", secret.ItemId);

            await _audit.RecordAsync(
                caller,
                SecretAuditActions.Rotate,
                secret,
                SecretAuditOutcomes.PartialFailure,
                SecretAuditReasons.MetadataWriteFailed,
                cancellationToken: CancellationToken.None).ConfigureAwait(false);

            throw;
        }

        await _audit.RecordAsync(caller, SecretAuditActions.Rotate, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public Task LockAsync(string secretId, CancellationToken cancellationToken = default) =>
        TransitionAsync(secretId, SecretAuditActions.Lock, "lock", [SecretStatuses.Active], SecretStatuses.Locked, cancellationToken);

    public Task UnlockAsync(string secretId, CancellationToken cancellationToken = default) =>
        TransitionAsync(secretId, SecretAuditActions.Unlock, "unlock", [SecretStatuses.Locked], SecretStatuses.Active, cancellationToken);

    public async Task DeleteAsync(string secretId, CancellationToken cancellationToken = default)
    {
        var caller = _authorization.ResolveContext();
        var secret = await LoadAsync(caller, secretId, cancellationToken).ConfigureAwait(false);

        EnsureTransitionAllowed(secret, "delete", [SecretStatuses.Active, SecretStatuses.Locked]);

        secret.Status = SecretStatuses.Deleted;
        secret.DeletedBy = caller.UserId;
        secret.DeletedDate = DateTime.UtcNow;
        Touch(secret, caller);

        // Metadata only. The vault value stays: Key Vault's purge protection would block
        // re-creating the key inside the retention window, which would make restore impossible.
        await _repository.ReplaceAsync(secret, cancellationToken).ConfigureAwait(false);
        await _audit.RecordAsync(caller, SecretAuditActions.Delete, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public async Task RestoreAsync(string secretId, CancellationToken cancellationToken = default)
    {
        var caller = _authorization.ResolveContext();
        var secret = await LoadAsync(caller, secretId, cancellationToken).ConfigureAwait(false);

        EnsureTransitionAllowed(secret, "restore", [SecretStatuses.Deleted]);

        secret.Status = SecretStatuses.Active;
        secret.DeletedBy = null;
        secret.DeletedDate = null;
        Touch(secret, caller);

        await _repository.ReplaceAsync(secret, cancellationToken).ConfigureAwait(false);
        await _audit.RecordAsync(caller, SecretAuditActions.Restore, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    public async Task UpdateAccessAsync(string secretId, SecretAccess access, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(access);

        var caller = _authorization.ResolveContext();
        var secret = await LoadForMutationAsync(caller, secretId, "update access", cancellationToken).ConfigureAwait(false);

        if (string.Equals(secret.Type, SecretTypes.Service, StringComparison.Ordinal))
        {
            throw new SecretValidationException(
                "Service secrets have no access list; they are readable by any valid tenant context.",
                SecretAuditReasons.AccessNotApplicable);
        }

        secret.Access = access;
        Touch(secret, caller);

        await _repository.ReplaceAsync(secret, cancellationToken).ConfigureAwait(false);
        await _audit.RecordAsync(caller, SecretAuditActions.UpdateAccess, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    private async Task TransitionAsync(
        string secretId,
        string action,
        string actionLabel,
        string[] allowedFrom,
        string target,
        CancellationToken cancellationToken)
    {
        var caller = _authorization.ResolveContext();
        var secret = await LoadAsync(caller, secretId, cancellationToken).ConfigureAwait(false);

        EnsureTransitionAllowed(secret, actionLabel, allowedFrom);

        secret.Status = target;
        Touch(secret, caller);

        await _repository.ReplaceAsync(secret, cancellationToken).ConfigureAwait(false);
        await _audit.RecordAsync(caller, action, secret, cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    #endregion

    #region Audit

    public async Task<SecretAuditListResult> GetAuditLogsAsync(SecretAuditFilter filter, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var caller = _authorization.ResolveContext();

        filter.PageNumber = Math.Max(1, filter.PageNumber);
        filter.PageSize = Math.Clamp(filter.PageSize, 1, SecretDefaults.MaxPageSize);

        var (items, total) = await _auditRepository.FindAsync(caller.TenantId, filter, cancellationToken).ConfigureAwait(false);

        return new SecretAuditListResult
        {
            Data = items.Select(ToAuditResult).ToList(),
            TotalCount = total
        };
    }

    #endregion
}
