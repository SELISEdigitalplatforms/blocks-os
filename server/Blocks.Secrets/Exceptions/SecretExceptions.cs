namespace Blocks.Secrets;

/// <summary>Base for every failure the secret domain raises.</summary>
public abstract class SecretException : Exception
{
    protected SecretException(string message) : base(message)
    {
    }

    protected SecretException(string message, Exception innerException) : base(message, innerException)
    {
    }

    /// <summary>Machine-readable code from <see cref="SecretAuditReasons"/>, where one applies.</summary>
    public string? ReasonCode { get; protected set; }
}

/// <summary>The request was malformed or violated a domain rule. Maps to HTTP 400.</summary>
public sealed class SecretValidationException : SecretException
{
    public SecretValidationException(string message, string? reasonCode = null) : base(message)
    {
        ReasonCode = reasonCode;
    }
}

/// <summary>
/// The caller may not perform this operation on this secret. Maps to HTTP 403.
/// </summary>
public sealed class SecretAccessDeniedException : SecretException
{
    public SecretAccessDeniedException(string reasonCode, string? message = null)
        : base(message ?? $"Access to the secret was denied ({reasonCode}).")
    {
        ReasonCode = reasonCode;
    }
}

/// <summary>
/// No such secret in the caller's tenant. Maps to HTTP 404.
/// </summary>
/// <remarks>
/// Deliberately also used when a secret exists under a different tenant. Returning 403 there
/// would confirm the id exists and leak the shape of other tenants' data.
/// </remarks>
public sealed class SecretNotFoundException : SecretException
{
    public SecretNotFoundException(string secretId, string? reasonCode = null)
        : base($"Secret '{secretId}' was not found.")
    {
        SecretId = secretId;
        ReasonCode = reasonCode;
    }

    public string SecretId { get; }
}

/// <summary>
/// The secret's current status forbids the attempted action. Maps to HTTP 409.
/// </summary>
public sealed class SecretStateException : SecretException
{
    public SecretStateException(string currentStatus, string attemptedAction, string? reasonCode = null)
        : base($"Cannot perform '{attemptedAction}' on a secret with status '{currentStatus}'.")
    {
        CurrentStatus = currentStatus;
        AttemptedAction = attemptedAction;
        ReasonCode = reasonCode;
    }

    public string CurrentStatus { get; }

    public string AttemptedAction { get; }
}

/// <summary>
/// The vault could not be reached or refused the operation. Maps to HTTP 502.
/// </summary>
/// <remarks>
/// The value store throws rather than returning an empty string: an empty string is a valid
/// secret value, so collapsing a vault outage into one would let callers authenticate with
/// blank credentials and never notice.
/// </remarks>
public sealed class SecretVaultException : SecretException
{
    public SecretVaultException(string message, string operation, string secretId, Exception? innerException = null)
        : base(message, innerException ?? new InvalidOperationException(message))
    {
        Operation = operation;
        SecretId = secretId;
        ReasonCode = SecretAuditReasons.VaultFailure;
    }

    public string Operation { get; }

    /// <summary>The secret id involved. An opaque identifier, never a value.</summary>
    public string SecretId { get; }
}
