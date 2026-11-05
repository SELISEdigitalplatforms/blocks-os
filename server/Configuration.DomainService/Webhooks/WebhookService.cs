using Blocks.Genesis;
using Configuration.DomainService.Actions;
using Configuration.DomainService.Shared.Services;
using Microsoft.Extensions.Logging;

namespace Configuration.DomainService.Webhooks;

/// <summary>Rules of the Webhooks page: list, read, save (create or update) and delete. Never returns a secret.</summary>
public interface IWebhookService
{
    Task<IReadOnlyList<WebhookView>> GetsAsync(CancellationToken cancellationToken);

    Task<ServiceOutcome<WebhookView>> GetAsync(string id, CancellationToken cancellationToken);

    Task<ServiceOutcome<WebhookView>> SaveAsync(SaveWebhookRequest request, CancellationToken cancellationToken);

    Task<ServiceOutcome<bool>> DeleteAsync(string id, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IWebhookService"/>
public sealed class WebhookService : IWebhookService
{
    private readonly IWebhookRepository _webhooks;
    private readonly IActionsRepository _actions;
    private readonly IWebhookSecretStore _secrets;
    private readonly IWebhookAddressGuard _addressGuard;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<WebhookService> _logger;

    public WebhookService(
        IWebhookRepository webhooks,
        IActionsRepository actions,
        IWebhookSecretStore secrets,
        IWebhookAddressGuard addressGuard,
        TimeProvider timeProvider,
        ILogger<WebhookService> logger)
    {
        _webhooks = webhooks;
        _actions = actions;
        _secrets = secrets;
        _addressGuard = addressGuard;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    public async Task<IReadOnlyList<WebhookView>> GetsAsync(CancellationToken cancellationToken) =>
        [.. (await _webhooks.GetAllAsync(cancellationToken)).Select(WebhookView.From)];

    public async Task<ServiceOutcome<WebhookView>> GetAsync(string id, CancellationToken cancellationToken)
    {
        var entry = string.IsNullOrWhiteSpace(id) ? null : await _webhooks.GetAsync(id, cancellationToken);
        return entry is null
            ? ServiceOutcome<WebhookView>.NotFound(WebhookErrorCodes.WebhookNotFound)
            : ServiceOutcome<WebhookView>.Ok(WebhookView.From(entry));
    }

    public Task<ServiceOutcome<WebhookView>> SaveAsync(SaveWebhookRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return SaveCoreAsync(request, cancellationToken);
    }

    public async Task<ServiceOutcome<bool>> DeleteAsync(string id, CancellationToken cancellationToken)
    {
        var entry = string.IsNullOrWhiteSpace(id) ? null : await _webhooks.GetAsync(id, cancellationToken);
        if (entry is null || !await _webhooks.DeleteAsync(entry.Id, cancellationToken))
        {
            return ServiceOutcome<bool>.NotFound(WebhookErrorCodes.WebhookNotFound);
        }

        // Entry first, then its secret; the history rows stay (they keep the webhook id).
        await _secrets.RetireQuietlyAsync(entry.SecretRef);
        _logger.LogInformation("Webhook {WebhookId} deleted", entry.Id);
        return ServiceOutcome<bool>.Ok(true);
    }

    private async Task<ServiceOutcome<WebhookView>> SaveCoreAsync(SaveWebhookRequest request, CancellationToken cancellationToken)
    {
        var isCreate = string.IsNullOrWhiteSpace(request.Id);
        var existing = isCreate ? null : await _webhooks.GetAsync(request.Id!, cancellationToken);
        if (!isCreate && existing is null)
        {
            return ServiceOutcome<WebhookView>.NotFound(WebhookErrorCodes.WebhookNotFound);
        }

        var error = ValidateShape(request, isCreate) ?? await ValidateRulesAsync(request, existing, cancellationToken);
        if (error is not null)
        {
            return ServiceOutcome<WebhookView>.BadRequest(error);
        }

        return existing is null
            ? await CreateAsync(request, cancellationToken)
            : await UpdateAsync(request, existing, cancellationToken);
    }

    private static string? ValidateShape(SaveWebhookRequest request, bool isCreate)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return WebhookErrorCodes.NameRequired;
        }

        if (isCreate || !string.IsNullOrEmpty(request.Secret))
        {
            if (request.Secret is null || request.Secret.Length < WebhookSignature.MinSecretLength)
            {
                return WebhookErrorCodes.SecretRequired;
            }

            if (!WebhookSignature.IsUsable(request.Secret))
            {
                return WebhookErrorCodes.SecretInvalid;
            }
        }

        return request.Actions is null || request.Actions.Count == 0 ? WebhookErrorCodes.ActionsRequired : null;
    }

    private async Task<string?> ValidateRulesAsync(SaveWebhookRequest request, WebhookEntry? existing, CancellationToken cancellationToken)
    {
        if (!await _addressGuard.IsUrlAllowedAsync(request.Url, cancellationToken))
        {
            return WebhookErrorCodes.UrlNotAllowed;
        }

        // The tenant list holds only the actions an admin switched on: a name is allowed when its webhook flag is on,
        // or when this webhook already has it (so an old webhook can still be saved after the flag went off).
        var known = (await _actions.GetAllAsync(cancellationToken))
            .Where(d => d is not null && d.Webhook)
            .Select(d => d.Name)
            .ToHashSet(StringComparer.Ordinal);
        known.UnionWith(existing?.Actions ?? []);
        return request.Actions.TrueForAll(known.Contains) ? null : WebhookErrorCodes.ActionNotFound;
    }

    private async Task<ServiceOutcome<WebhookView>> CreateAsync(SaveWebhookRequest request, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var entry = new WebhookEntry
        {
            Id = Guid.NewGuid().ToString("N"),
            Name = request.Name.Trim(),
            NameKey = WebhookEntry.KeyOf(request.Name),
            Url = request.Url.Trim(),
            IsActive = request.IsActive,
            Actions = [.. request.Actions.Distinct(StringComparer.Ordinal)],
            CreatedDate = now,
            CreatedBy = BlocksContext.GetContext()?.UserId,
            SecretChangedDate = now
        };

        // Secret store first: no webhook is ever saved without its secret.
        entry.SecretRef = await _secrets.CreateAsync(entry.Id, request.Secret!, cancellationToken);
        var written = await WriteOrUndoAsync(entry.SecretRef, () => _webhooks.InsertAsync(entry, cancellationToken));
        if (written != WebhookWriteResult.Written)
        {
            return ServiceOutcome<WebhookView>.BadRequest(WebhookErrorCodes.NameTaken);
        }

        _logger.LogInformation("Webhook {WebhookId} created for host {Host}", entry.Id, WebhookAttemptRunner.HostOf(entry.Url));
        return ServiceOutcome<WebhookView>.Ok(WebhookView.From(entry));
    }

    private async Task<ServiceOutcome<WebhookView>> UpdateAsync(SaveWebhookRequest request, WebhookEntry existing, CancellationToken cancellationToken)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var newSecretRef = string.IsNullOrEmpty(request.Secret)
            ? null
            : await _secrets.CreateAsync(existing.Id, request.Secret, cancellationToken);
        var update = new WebhookUpdate(
            existing.Id,
            request.Name.Trim(),
            request.Url.Trim(),
            request.IsActive,
            [.. request.Actions.Distinct(StringComparer.Ordinal)],
            newSecretRef,
            newSecretRef is null ? null : now,
            ResetFailures: request.IsActive && !existing.IsActive);

        var written = await WriteOrUndoAsync(newSecretRef, () => _webhooks.UpdateAsync(update, cancellationToken));
        switch (written)
        {
            case WebhookWriteResult.NotFound:
                return ServiceOutcome<WebhookView>.NotFound(WebhookErrorCodes.WebhookNotFound);
            case WebhookWriteResult.NameTaken:
                return ServiceOutcome<WebhookView>.BadRequest(WebhookErrorCodes.NameTaken);
        }

        if (newSecretRef is not null)
        {
            // The new secret replaces the old one at once: no overlap window.
            await _secrets.RetireQuietlyAsync(existing.SecretRef);
        }

        _logger.LogInformation("Webhook {WebhookId} updated (secret replaced: {SecretReplaced})", existing.Id, newSecretRef is not null);
        var saved = await _webhooks.GetAsync(existing.Id, cancellationToken);
        return saved is null
            ? ServiceOutcome<WebhookView>.NotFound(WebhookErrorCodes.WebhookNotFound)
            : ServiceOutcome<WebhookView>.Ok(WebhookView.From(saved));
    }

    // A KV write that fails or is refused retires the secret this save created, so no orphan secret stays.
    private async Task<WebhookWriteResult> WriteOrUndoAsync(string? newSecretRef, Func<Task<WebhookWriteResult>> write)
    {
        WebhookWriteResult result;
        try
        {
            result = await write();
        }
        catch
        {
            if (newSecretRef is not null)
            {
                await _secrets.RetireQuietlyAsync(newSecretRef);
            }

            throw;
        }

        if (result != WebhookWriteResult.Written && newSecretRef is not null)
        {
            await _secrets.RetireQuietlyAsync(newSecretRef);
        }

        return result;
    }
}
